const { supabaseAdmin, supabaseAnon } = require('../config/supabase');
const ApiError = require('../utils/ApiError');

const PRODUCT_SELECT = '*, brand:brands(id,name,slug,country,logo_url), product_categories(category:categories(id,name,slug)), product_variants(*)';
const ACTIVE_PRODUCT_SELECT = '*, brand:brands(id,name,slug,country,logo_url), product_categories(category:categories(id,name,slug)), product_variants(*)';

function check(result) {
  if (result.error) throw result.error;
  return result.data;
}

function one(result, message = 'Resource not found') {
  const data = check(result);
  if (!data) throw new ApiError(404, message);
  return data;
}

function slugify(text) {
  return text.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function pageValues(query) {
  const page = Number(query.page || 1);
  const limit = Number(query.limit || 12);
  return { page, limit, from: (page - 1) * limit, to: page * limit - 1 };
}

async function resolveProductId(idOrSlug) {
  const column = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(idOrSlug) ? 'id' : 'slug';
  const product = one(await supabaseAdmin.from('products').select('id').eq(column, idOrSlug).maybeSingle());
  return product.id;
}

async function getCart(userId, create = true) {
  let result = await supabaseAdmin.from('carts').select('id').eq('user_id', userId).maybeSingle();
  const cart = check(result);
  if (cart || !create) return cart;
  result = await supabaseAdmin.from('carts').insert({ user_id: userId }).select('id').single();
  return one(result);
}

async function cartSubtotal(userId) {
  const cart = await getCart(userId, false);
  if (!cart) return { cart: null, subtotal: 0 };
  const rows = check(await supabaseAdmin.from('cart_items')
    .select('quantity, variant:product_variants(price_cents)').eq('cart_id', cart.id));
  return {
    cart,
    subtotal: rows.reduce((sum, item) => sum + item.quantity * item.variant.price_cents, 0),
  };
}

function mapOrderError(error) {
  const message = error.message || '';
  const match = message.match(/^(CART_EMPTY|ITEM_UNAVAILABLE|INSUFFICIENT_STOCK|INVALID_SHIPPING|INVALID_COUPON):\s*(.*)$/s);
  if (!match) throw error;
  const status = match[1] === 'CART_EMPTY' || match[1] === 'INVALID_SHIPPING' || match[1] === 'INVALID_COUPON' ? 400 : 409;
  throw new ApiError(status, match[2]);
}

const api = {
  health: async () => ({ status: 'ok' }),

  authenticatedUser: async (token) => {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) throw new ApiError(401, 'Invalid or expired token');
    const profile = one(await supabaseAdmin.from('profiles').select('*').eq('id', user.id).maybeSingle(), 'User profile not found');
    return { ...profile, email: user.email };
  },
  register: async ({ body: { email, password, full_name, phone } }) => {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: { full_name, phone },
    });
    if (error) {
      if (error.message.toLowerCase().includes('already')) throw new ApiError(409, 'An account with this email already exists');
      throw new ApiError(400, error.message);
    }
    return { id: data.user.id, email: data.user.email };
  },
  login: async ({ body: { email, password } }) => {
    const { data, error } = await supabaseAnon.auth.signInWithPassword({ email, password });
    if (error) throw new ApiError(401, 'Invalid email or password');
    const profile = one(await supabaseAdmin.from('profiles').select('*').eq('id', data.user.id).maybeSingle(), 'User profile not found');
    return { access_token: data.session.access_token, refresh_token: data.session.refresh_token, profile };
  },
  logout: async ({ token }) => {
    const { error } = await supabaseAdmin.auth.admin.signOut(token, 'local');
    if (error) throw new ApiError(401, error.message);
    return { message: 'Logged out' };
  },
  refresh: async ({ body: { refresh_token } }) => {
    const { data, error } = await supabaseAdmin.auth.refreshSession({ refresh_token });
    if (error) throw new ApiError(401, 'Invalid or expired refresh token');
    return { access_token: data.session.access_token, refresh_token: data.session.refresh_token };
  },
  forgotPassword: async ({ body: { email } }) => {
    const { error } = await supabaseAnon.auth.resetPasswordForEmail(email);
    if (error) throw new ApiError(400, error.message);
    return { message: 'If an account exists, password reset instructions have been sent' };
  },
  me: async ({ user }) => user,

  getProfile: async ({ user }) => one(await supabaseAdmin.from('profiles').select('*').eq('id', user.id).maybeSingle()),
  updateProfile: async ({ user, body }) => one(await supabaseAdmin.from('profiles')
    .update(body).eq('id', user.id).select('*').maybeSingle()),

  listAddresses: async ({ user }) => check(await supabaseAdmin.from('addresses').select('*').eq('user_id', user.id).order('is_default', { ascending: false }).order('created_at')),
  createAddress: async ({ user, body }) => {
    if (body.is_default) check(await supabaseAdmin.from('addresses').update({ is_default: false }).eq('user_id', user.id));
    return one(await supabaseAdmin.from('addresses').insert({ ...body, user_id: user.id }).select('*').single());
  },
  updateAddress: async ({ user, params, body }) => {
    one(await supabaseAdmin.from('addresses').select('id').eq('user_id', user.id).eq('id', params.id).maybeSingle());
    if (body.is_default) check(await supabaseAdmin.from('addresses').update({ is_default: false }).eq('user_id', user.id));
    return one(await supabaseAdmin.from('addresses').update(body).eq('user_id', user.id).eq('id', params.id).select('*').maybeSingle());
  },
  defaultAddress: async ({ user, params }) => {
    one(await supabaseAdmin.from('addresses').select('id').eq('user_id', user.id).eq('id', params.id).maybeSingle());
    check(await supabaseAdmin.from('addresses').update({ is_default: false }).eq('user_id', user.id));
    return one(await supabaseAdmin.from('addresses').update({ is_default: true }).eq('user_id', user.id).eq('id', params.id).select('*').maybeSingle());
  },
  deleteAddress: async ({ user, params }) => {
    const row = one(await supabaseAdmin.from('addresses').delete().eq('user_id', user.id).eq('id', params.id).select('id').maybeSingle());
    return { id: row.id };
  },

  listBrands: async () => check(await supabaseAdmin.from('brands').select('*').eq('is_active', true).order('name')),
  brandBySlug: async ({ params }) => one(await supabaseAdmin.from('brands').select('*').eq('slug', params.slug).eq('is_active', true).maybeSingle()),
  listCategories: async () => check(await supabaseAdmin.from('categories').select('*').eq('is_active', true).order('name')),
  listProducts: async ({ query }) => {
    const { page, limit, from, to } = pageValues(query);
    let request = supabaseAdmin.from('products').select(ACTIVE_PRODUCT_SELECT, { count: 'exact' }).eq('is_active', true);
    if (query.search) request = request.ilike('name', `%${query.search.replace(/[%_,]/g, '')}%`);
    if (query.brand) {
      const brand = await supabaseAdmin.from('brands').select('id').eq('slug', query.brand).maybeSingle();
      const found = check(brand);
      if (!found) return { items: [], pagination: { page, limit, total: 0, pages: 0 } };
      request = request.eq('brand_id', found.id);
    }
    if (query.category) {
      const categories = check(await supabaseAdmin.from('categories').select('id').eq('slug', query.category).eq('is_active', true).maybeSingle());
      if (!categories) return { items: [], pagination: { page, limit, total: 0, pages: 0 } };
      const linked = check(await supabaseAdmin.from('product_categories').select('product_id').eq('category_id', categories.id));
      const ids = linked.map((item) => item.product_id);
      if (!ids.length) return { items: [], pagination: { page, limit, total: 0, pages: 0 } };
      request = request.in('id', ids);
    }
    if (query.gender) request = request.eq('gender', query.gender);
    if (query.fragrance_family) request = request.ilike('fragrance_family', query.fragrance_family.replace(/[%_,]/g, ''));
    if (query.featured !== undefined) request = request.eq('is_featured', query.featured === 'true');
    if (query.new !== undefined) request = request.eq('is_new_arrival', query.new === 'true');
    if (query.bestseller !== undefined) request = request.eq('is_bestseller', query.bestseller === 'true');
    let priceOrderedIds;
    if (query.min_price !== undefined || query.max_price !== undefined || query.sort === 'price_asc' || query.sort === 'price_desc') {
      let variantsQuery = supabaseAdmin.from('product_variants').select('product_id,price_cents').eq('is_active', true)
        .gte('price_cents', Number(query.min_price === undefined ? 0 : query.min_price))
        .lte('price_cents', Number(query.max_price === undefined ? 2147483647 : query.max_price))
        .order('price_cents', { ascending: query.sort !== 'price_desc' });
      const variants = check(await variantsQuery);
      priceOrderedIds = [...new Set(variants.map((variant) => variant.product_id))];
      if (!priceOrderedIds.length) return { items: [], pagination: { page, limit, total: 0, pages: 0 } };
      request = request.in('id', priceOrderedIds);
    }
    const sort = query.sort || 'featured';
    const sortFields = { featured: 'is_featured', newest: 'created_at', price_asc: 'created_at', price_desc: 'created_at', popular: 'is_bestseller' };
    if (sort !== 'price_asc' && sort !== 'price_desc') request = request.order(sortFields[sort], { ascending: false });
    const usePriceOrder = query.sort === 'price_asc' || query.sort === 'price_desc';
    const result = await request.range(usePriceOrder ? 0 : from, usePriceOrder ? 9999 : to);
    let items = check(result).map((product) => ({
      ...product,
      product_variants: product.product_variants.filter((variant) => variant.is_active),
    }));
    const total = result.count || 0;
    if (usePriceOrder) {
      const order = new Map(priceOrderedIds.map((id, index) => [id, index]));
      items.sort((a, b) => order.get(a.id) - order.get(b.id));
      items = items.slice(from, to + 1);
    }
    return { items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
  },
  productByIdOrSlug: async ({ params }) => {
    const column = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(params.idOrSlug) ? 'id' : 'slug';
    const product = one(await supabaseAdmin.from('products').select(ACTIVE_PRODUCT_SELECT)
      .eq(column, params.idOrSlug).eq('is_active', true).maybeSingle());
    product.product_variants = product.product_variants.filter((variant) => variant.is_active);
    product.product_images = check(await supabaseAdmin.from('product_images').select('*')
      .eq('product_id', product.id).order('sort_order'));
    const reviews = check(await supabaseAdmin.from('reviews').select('rating')
      .eq('product_id', product.id).eq('is_approved', true));
    product.review_count = reviews.length;
    product.review_average = reviews.length ? reviews.reduce((sum, row) => sum + row.rating, 0) / reviews.length : null;
    return product;
  },
  adminList: async ({ resource }) => check(await supabaseAdmin.from(resource.table).select('*').order(resource.order || 'created_at', { ascending: false })),
  adminGet: async ({ resource, params }) => one(await supabaseAdmin.from(resource.table).select('*').eq('id', params.id).maybeSingle()),
  adminCreate: async ({ resource, body }) => {
    const fields = { ...body };
    if (['brands', 'categories'].includes(resource.table) && !fields.slug) fields.slug = slugify(fields.name);
    return one(await supabaseAdmin.from(resource.table).insert(fields).select('*').single());
  },
  adminUpdate: async ({ resource, params, body }) => one(await supabaseAdmin.from(resource.table).update(body).eq('id', params.id).select('*').maybeSingle()),
  adminDelete: async ({ resource, params }) => {
    const row = one(await supabaseAdmin.from(resource.table).delete().eq('id', params.id).select('id').maybeSingle());
    return { id: row.id };
  },

  adminProducts: async () => check(await supabaseAdmin.from('products').select(PRODUCT_SELECT).order('created_at', { ascending: false })),
  createProduct: async ({ body }) => {
    const { categories = [], variants = [], ...fields } = body;
    fields.slug = fields.slug || slugify(fields.name);
    const product = one(await supabaseAdmin.from('products').insert(fields).select('*').single());
    if (categories.length) check(await supabaseAdmin.from('product_categories').insert(categories.map((category_id) => ({ product_id: product.id, category_id }))));
    if (variants.length) check(await supabaseAdmin.from('product_variants').insert(variants.map((variant) => ({ ...variant, product_id: product.id }))));
    return one(await supabaseAdmin.from('products').select(PRODUCT_SELECT).eq('id', product.id).single());
  },
  updateProduct: async ({ params, body }) => {
    const { categories, ...fields } = body;
    const product = Object.keys(fields).length
      ? one(await supabaseAdmin.from('products').update(fields).eq('id', params.id).select('*').maybeSingle())
      : one(await supabaseAdmin.from('products').select('*').eq('id', params.id).maybeSingle());
    if (categories) {
      check(await supabaseAdmin.from('product_categories').delete().eq('product_id', params.id));
      if (categories.length) check(await supabaseAdmin.from('product_categories').insert(categories.map((category_id) => ({ product_id: params.id, category_id }))));
    }
    return one(await supabaseAdmin.from('products').select(PRODUCT_SELECT).eq('id', product.id).single());
  },
  productStatus: async ({ params, body }) => one(await supabaseAdmin.from('products')
    .update({ is_active: body.is_active }).eq('id', params.id).select('*').maybeSingle()),
  deleteProduct: async ({ params }) => {
    const linked = await supabaseAdmin.from('order_items').select('id', { count: 'exact', head: true }).eq('product_id', params.id);
    if (linked.error) throw linked.error;
    if (linked.count) return one(await supabaseAdmin.from('products').update({ is_active: false }).eq('id', params.id).select('*').maybeSingle());
    const row = one(await supabaseAdmin.from('products').delete().eq('id', params.id).select('id').maybeSingle());
    return { id: row.id, deleted: true };
  },
  createVariant: async ({ params, body }) => one(await supabaseAdmin.from('product_variants')
    .insert({ ...body, product_id: params.id }).select('*').single()),
  updateVariant: async ({ params, body }) => one(await supabaseAdmin.from('product_variants')
    .update(body).eq('id', params.id).select('*').maybeSingle()),
  stockVariant: async ({ params, body }) => one(await supabaseAdmin.from('product_variants')
    .update({ stock_quantity: body.stock_quantity }).eq('id', params.id).select('*').maybeSingle()),
  deleteVariant: async ({ params }) => {
    const row = one(await supabaseAdmin.from('product_variants').delete().eq('id', params.id).select('id').maybeSingle());
    return { id: row.id };
  },
  uploadProductImage: async ({ params, file, kind }) => {
    const product = one(await supabaseAdmin.from('products').select('id,main_image_url').eq('id', params.id).maybeSingle());
    const extension = file.mimetype === 'image/jpeg' ? 'jpg' : file.mimetype.split('/')[1];
    const path = `${product.id}/${kind}-${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
    const { data, error } = await supabaseAdmin.storage.from('product-images').upload(path, file.buffer, { contentType: file.mimetype, upsert: false });
    if (error) throw error;
    const { data: urlData } = supabaseAdmin.storage.from('product-images').getPublicUrl(data.path);
    if (kind === 'main') {
      const updated = await supabaseAdmin.from('products').update({ main_image_url: urlData.publicUrl }).eq('id', product.id);
      if (updated.error) throw updated.error;
      if (product.main_image_url) {
        const oldPath = product.main_image_url.split('/product-images/')[1];
        if (oldPath) {
          const removed = await supabaseAdmin.storage.from('product-images').remove([decodeURIComponent(oldPath)]);
          if (removed.error) throw removed.error;
        }
      }
      return { image_url: urlData.publicUrl };
    }
    return one(await supabaseAdmin.from('product_images').insert({
      product_id: product.id, image_url: urlData.publicUrl, storage_path: data.path,
    }).select('*').single());
  },
  deleteGalleryImage: async ({ params }) => {
    const image = one(await supabaseAdmin.from('product_images').delete()
      .eq('product_id', params.id).eq('id', params.imageId).select('*').maybeSingle());
    if (image.storage_path) {
      const { error } = await supabaseAdmin.storage.from('product-images').remove([image.storage_path]);
      if (error) throw error;
    }
    return { id: image.id };
  },

  wishlist: async ({ user }) => {
    const rows = check(await supabaseAdmin.from('wishlists').select('*, product:products(id,name,slug,main_image_url,brand:brands(name))').eq('user_id', user.id).order('created_at', { ascending: false }));
    return rows;
  },
  addWishlist: async ({ user, params }) => {
    const row = check(await supabaseAdmin.from('wishlists')
      .upsert({ user_id: user.id, product_id: params.productId }, { onConflict: 'user_id,product_id', ignoreDuplicates: true })
      .select('*').maybeSingle());
    return row || { product_id: params.productId };
  },
  deleteWishlist: async ({ user, params }) => {
    const result = await supabaseAdmin.from('wishlists').delete().eq('user_id', user.id).eq('product_id', params.productId);
    check(result);
    return { product_id: params.productId };
  },
  getCart: async ({ user }) => {
    const cart = await getCart(user.id);
    const rows = check(await supabaseAdmin.from('cart_items').select('id,quantity,variant:product_variants(id,size_label,price_cents,stock_quantity,product:products(id,name,slug,main_image_url,brand:brands(name)))')
      .eq('cart_id', cart.id).order('created_at'));
    const items = rows.map((row) => ({
      id: row.id, variant_id: row.variant.id, name: row.variant.product.name,
      brand: row.variant.product.brand.name, size: row.variant.size_label,
      image: row.variant.product.main_image_url, unit_price_cents: row.variant.price_cents,
      quantity: row.quantity, line_total_cents: row.variant.price_cents * row.quantity,
    }));
    return { items, subtotal_cents: items.reduce((sum, row) => sum + row.line_total_cents, 0) };
  },
  addCartItem: async ({ user, body }) => {
    const variant = one(await supabaseAdmin.from('product_variants').select('id,product_id,stock_quantity,is_active,product:products(is_active)')
      .eq('id', body.variant_id).maybeSingle());
    if (!variant.is_active || !variant.product.is_active) throw new ApiError(409, 'Product variant is unavailable');
    const cart = await getCart(user.id);
    const current = check(await supabaseAdmin.from('cart_items').select('id,quantity').eq('cart_id', cart.id).eq('variant_id', variant.id).maybeSingle());
    const quantity = body.quantity + (current ? current.quantity : 0);
    if (quantity > variant.stock_quantity) throw new ApiError(409, 'Insufficient stock');
    const operation = current
      ? supabaseAdmin.from('cart_items').update({ quantity }).eq('id', current.id)
      : supabaseAdmin.from('cart_items').insert({ cart_id: cart.id, variant_id: variant.id, quantity });
    return one(await operation.select('*').single());
  },
  updateCartItem: async ({ user, params, body }) => {
    const cart = await getCart(user.id, false);
    if (!cart) throw new ApiError(404, 'Cart item not found');
    const row = one(await supabaseAdmin.from('cart_items').select('id,variant_id').eq('cart_id', cart.id).eq('id', params.itemId).maybeSingle());
    const variant = one(await supabaseAdmin.from('product_variants').select('stock_quantity,is_active,product:products(is_active)').eq('id', row.variant_id).maybeSingle());
    if (!variant.is_active || !variant.product.is_active) throw new ApiError(409, 'Product variant is unavailable');
    if (body.quantity > variant.stock_quantity) throw new ApiError(409, 'Insufficient stock');
    return one(await supabaseAdmin.from('cart_items').update({ quantity: body.quantity }).eq('id', row.id).select('*').single());
  },
  deleteCartItem: async ({ user, params }) => {
    const cart = await getCart(user.id, false);
    if (!cart) throw new ApiError(404, 'Cart item not found');
    const row = one(await supabaseAdmin.from('cart_items').delete().eq('cart_id', cart.id).eq('id', params.itemId).select('id').maybeSingle());
    return { id: row.id };
  },
  clearCart: async ({ user }) => {
    const cart = await getCart(user.id, false);
    if (cart) check(await supabaseAdmin.from('cart_items').delete().eq('cart_id', cart.id));
    return { cleared: true };
  },

  shippingMethods: async () => check(await supabaseAdmin.from('shipping_methods').select('*').eq('is_active', true).order('price_cents')),
  validateCoupon: async ({ user, body }) => {
    const { subtotal } = await cartSubtotal(user.id);
    const coupon = one(await supabaseAdmin.from('coupons').select('*').ilike('code', body.code.trim()).maybeSingle(), 'Invalid coupon');
    const now = Date.now();
    if (!coupon.is_active || (coupon.starts_at && new Date(coupon.starts_at).getTime() > now)
      || (coupon.expires_at && new Date(coupon.expires_at).getTime() <= now)
      || (coupon.usage_limit !== null && coupon.used_count >= coupon.usage_limit)
      || subtotal < coupon.min_order_cents) throw new ApiError(400, 'Coupon is invalid or does not meet its requirements');
    const discount = coupon.discount_type === 'percentage'
      ? Math.floor(subtotal * coupon.discount_value / 100) : coupon.discount_value;
    return { valid: true, code: coupon.code, subtotal_cents: subtotal, discount_cents: Math.min(discount, subtotal) };
  },

  createOrder: async ({ user, body }) => {
    let shippingAddress = body.shipping_address;
    if (body.address_id) {
      shippingAddress = one(await supabaseAdmin.from('addresses').select('recipient_name,phone,address_line1,address_line2,city,region,postal_code,country')
        .eq('id', body.address_id).eq('user_id', user.id).maybeSingle(), 'Address not found');
    }
    if (!shippingAddress) throw new ApiError(400, 'A shipping address or address_id is required');
    const { data, error } = await supabaseAdmin.rpc('create_order_from_cart', {
      p_user_id: user.id,
      p_shipping_address: shippingAddress,
      p_shipping_method_id: body.shipping_method_id,
      p_coupon_code: body.coupon_code || null,
      p_notes: body.notes || null,
      p_idempotency_key: body.idempotency_key,
    });
    if (error) mapOrderError(error);
    return data;
  },
  listOrders: async ({ user, query }) => {
    const { page, limit, from, to } = pageValues(query);
    const result = await supabaseAdmin.from('orders').select('*', { count: 'exact' }).eq('user_id', user.id)
      .order('created_at', { ascending: false }).range(from, to);
    return { items: check(result), pagination: { page, limit, total: result.count || 0, pages: Math.ceil((result.count || 0) / limit) } };
  },
  orderById: async ({ user, params }) => {
    const order = one(await supabaseAdmin.from('orders').select('*').eq('id', params.id).eq('user_id', user.id).maybeSingle());
    order.items = check(await supabaseAdmin.from('order_items').select('*').eq('order_id', order.id));
    return order;
  },
  cancelOrder: async ({ user, params }) => {
    const order = one(await supabaseAdmin.from('orders').select('*').eq('id', params.id).eq('user_id', user.id).maybeSingle());
    if (!['pending', 'confirmed'].includes(order.status)) throw new ApiError(409, 'Only pending or confirmed orders can be cancelled');
    const updated = one(await supabaseAdmin.from('orders').update({ status: 'cancelled' })
      .eq('id', order.id).in('status', ['pending', 'confirmed']).select('*').maybeSingle(), 'Order can no longer be cancelled');
    const items = check(await supabaseAdmin.from('order_items').select('variant_id,quantity').eq('order_id', order.id));
    for (const item of items) {
      if (item.variant_id) {
        const variant = one(await supabaseAdmin.from('product_variants').select('stock_quantity').eq('id', item.variant_id).maybeSingle());
        check(await supabaseAdmin.from('product_variants').update({ stock_quantity: variant.stock_quantity + item.quantity }).eq('id', item.variant_id));
      }
    }
    return updated;
  },
  adminOrders: async ({ query }) => {
    const { page, limit, from, to } = pageValues(query);
    let request = supabaseAdmin.from('orders').select('*', { count: 'exact' });
    if (query.status) request = request.eq('status', query.status);
    if (query.payment_status) request = request.eq('payment_status', query.payment_status);
    if (query.from) request = request.gte('created_at', query.from);
    if (query.to) request = request.lte('created_at', query.to);
    if (query.search) {
      const search = query.search.replace(/[^a-zA-Z0-9@.+-]/g, '');
      request = request.or(`order_number.ilike.%${search}%,customer_email.ilike.%${search}%`);
    }
    const result = await request.order('created_at', { ascending: false }).range(from, to);
    return { items: check(result), pagination: { page, limit, total: result.count || 0, pages: Math.ceil((result.count || 0) / limit) } };
  },
  adminOrder: async ({ params }) => {
    const order = one(await supabaseAdmin.from('orders').select('*, customer:profiles(id,full_name,email,phone)').eq('id', params.id).maybeSingle());
    order.items = check(await supabaseAdmin.from('order_items').select('*').eq('order_id', order.id));
    return order;
  },
  adminOrderStatus: async ({ params, body }) => {
    const order = one(await supabaseAdmin.from('orders').select('*').eq('id', params.id).maybeSingle());
    const transitions = { pending: ['confirmed', 'cancelled'], confirmed: ['processing', 'cancelled'], processing: ['shipped'], shipped: ['delivered'] };
    if (!transitions[order.status] || !transitions[order.status].includes(body.status)) throw new ApiError(409, `Cannot transition order from ${order.status} to ${body.status}`);
    const updated = one(await supabaseAdmin.from('orders').update({ status: body.status }).eq('id', order.id).eq('status', order.status).select('*').maybeSingle(), 'Order status changed concurrently');
    if (body.status === 'cancelled') {
      const items = check(await supabaseAdmin.from('order_items').select('variant_id,quantity').eq('order_id', order.id));
      for (const item of items) {
        if (!item.variant_id) continue;
        const variant = one(await supabaseAdmin.from('product_variants').select('stock_quantity').eq('id', item.variant_id).maybeSingle());
        check(await supabaseAdmin.from('product_variants').update({ stock_quantity: variant.stock_quantity + item.quantity }).eq('id', item.variant_id));
      }
    }
    return updated;
  },
  adminPaymentStatus: async ({ params, body }) => one(await supabaseAdmin.from('orders').update({ payment_status: body.payment_status })
    .eq('id', params.id).select('*').maybeSingle()),
  adminUpdateOrder: async ({ params, body }) => {
    const order = one(await supabaseAdmin.from('orders').select('status').eq('id', params.id).maybeSingle());
    if (['shipped', 'delivered'].includes(order.status)) throw new ApiError(409, 'Cannot edit a shipped or delivered order');
    return one(await supabaseAdmin.from('orders').update(body).eq('id', params.id).select('*').maybeSingle());
  },
  adminDeleteOrder: async ({ params }) => {
    const row = one(await supabaseAdmin.from('orders').delete().eq('id', params.id).eq('status', 'cancelled').select('id').maybeSingle());
    return { id: row.id };
  },
  adminStats: async () => {
    const orders = check(await supabaseAdmin.from('orders').select('status,total_cents,payment_status'));
    const lowStock = check(await supabaseAdmin.from('product_variants').select('id,sku,stock_quantity,low_stock_threshold,product:products(name)').eq('is_active', true));
    const ordersPerStatus = orders.reduce((counts, order) => ({ ...counts, [order.status]: (counts[order.status] || 0) + 1 }), {});
    return {
      total_orders: orders.length,
      revenue_cents: orders.filter((order) => order.payment_status === 'paid').reduce((sum, order) => sum + order.total_cents, 0),
      orders_per_status: ordersPerStatus,
      low_stock_variants: lowStock.filter((variant) => variant.stock_quantity <= variant.low_stock_threshold),
    };
  },

  productReviews: async ({ params, query }) => {
    const { page, limit, from, to } = pageValues(query);
    const productId = await resolveProductId(params.id || params.idOrSlug);
    const result = await supabaseAdmin.from('reviews').select('id,rating,title,body,verified_purchase,created_at,profile:profiles(full_name)', { count: 'exact' })
      .eq('product_id', productId).eq('is_approved', true).order('created_at', { ascending: false }).range(from, to);
    return { items: check(result), pagination: { page, limit, total: result.count || 0, pages: Math.ceil((result.count || 0) / limit) } };
  },
  createReview: async ({ user, params, body }) => {
    const productId = await resolveProductId(params.id || params.idOrSlug);
    const delivered = check(await supabaseAdmin.from('orders').select('id,order_items!inner(product_id)')
      .eq('user_id', user.id).eq('status', 'delivered').eq('order_items.product_id', productId).limit(1));
    return one(await supabaseAdmin.from('reviews').insert({
      ...body, user_id: user.id, product_id: productId, verified_purchase: delivered.length > 0, is_approved: false,
    }).select('*').single());
  },
  updateReview: async ({ user, params, body }) => one(await supabaseAdmin.from('reviews').update(body)
    .eq('id', params.id).eq('user_id', user.id).select('*').maybeSingle()),
  deleteReview: async ({ user, params }) => {
    const row = one(await supabaseAdmin.from('reviews').delete().eq('id', params.id).eq('user_id', user.id).select('id').maybeSingle());
    return { id: row.id };
  },
  adminReviews: async ({ query }) => {
    let request = supabaseAdmin.from('reviews').select('*, profile:profiles(full_name,email), product:products(name)');
    if (query.approved !== undefined) request = request.eq('is_approved', query.approved === 'true');
    return check(await request.order('created_at', { ascending: false }));
  },
  approveReview: async ({ params }) => one(await supabaseAdmin.from('reviews').update({ is_approved: true }).eq('id', params.id).select('*').maybeSingle()),
  adminDeleteReview: async ({ params }) => {
    const row = one(await supabaseAdmin.from('reviews').delete().eq('id', params.id).select('id').maybeSingle());
    return { id: row.id };
  },

  recommend: async ({ user, body }) => {
    const products = check(await supabaseAdmin.from('products').select('*, brand:brands(name), product_variants(*)')
      .eq('is_active', true));
    const candidates = products.filter((product) => product.product_variants.some((variant) => variant.is_active && variant.stock_quantity > 0
      && (body.max_price_cents === undefined || variant.price_cents <= body.max_price_cents)));
    const scored = candidates.map((product) => {
      const noteList = [...product.top_notes, ...product.heart_notes, ...product.base_notes];
      const matchingNotes = (body.preferred_notes || []).filter((note) => noteList.some((candidate) => candidate.toLowerCase().includes(note.toLowerCase())));
      let score = 0;
      if (body.fragrance_family && product.fragrance_family && product.fragrance_family.toLowerCase() === body.fragrance_family.toLowerCase()) score += 4;
      if (body.gender && product.gender === body.gender) score += 2;
      score += matchingNotes.length * 2;
      if (body.max_price_cents !== undefined) score += 1;
      const variant = product.product_variants.filter((item) => item.is_active && item.stock_quantity > 0
        && (body.max_price_cents === undefined || item.price_cents <= body.max_price_cents))
        .sort((a, b) => a.price_cents - b.price_cents)[0];
      const reasons = [];
      if (body.fragrance_family && product.fragrance_family?.toLowerCase() === body.fragrance_family.toLowerCase()) reasons.push(`matches the ${product.fragrance_family} fragrance family`);
      if (matchingNotes.length) reasons.push(`features ${matchingNotes.join(', ')}`);
      if (body.gender && product.gender === body.gender) reasons.push(`suits your ${body.gender} preference`);
      if (!reasons.length) reasons.push('is a popular in-stock fragrance to explore');
      return {
        score, product_id: product.id, name: product.name, brand: product.brand.name,
        matching_notes: matchingNotes, reason: `Recommended because it ${reasons.join(' and ')}.`,
        suitable_variant: { id: variant.id, size_label: variant.size_label, price_cents: variant.price_cents },
      };
    }).sort((a, b) => b.score - a.score).slice(0, 5);
    if (user) {
      check(await supabaseAdmin.from('ai_recommendations').insert({
        user_id: user.id, preferences: body,
        recommended_product_ids: scored.map((item) => item.product_id),
        explanation: scored.length ? 'Deterministic recommendations based on your preferences.' : 'No products matched your preferences.',
      }));
    }
    return { items: scored, message: scored.length ? undefined : 'No products match your preferences right now.' };
  },
  recommendationHistory: async ({ user }) => check(await supabaseAdmin.from('ai_recommendations').select('*')
    .eq('user_id', user.id).order('created_at', { ascending: false })),
};

module.exports = api;
