-- =====================================================
-- DEKANTCE - schema.sql  (pokreni PRVI, jednom)
-- =====================================================

-- ---------- Pomoćne funkcije ----------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create sequence if not exists public.order_number_seq start 1;

create or replace function public.generate_order_number()
returns text language sql as $$
  select 'DEK-' || to_char(now(), 'YYYY') || '-'
         || lpad(nextval('public.order_number_seq')::text, 6, '0');
$$;

-- ---------- Tabele ----------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  email       text,
  phone       text,
  avatar_url  text,
  role        text not null default 'customer' check (role in ('customer','admin')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.addresses (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  recipient_name text not null,
  phone          text,
  address_line1  text not null,
  address_line2  text,
  city           text not null,
  region         text,
  postal_code    text,
  country        text not null default 'Bosna i Hercegovina',
  is_default     boolean not null default false,
  created_at     timestamptz not null default now()
);

create table if not exists public.brands (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  slug        text not null unique,
  description text,
  logo_url    text,
  country     text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  slug        text not null unique,
  description text,
  image_url   text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists public.products (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  slug             text not null unique,
  brand_id         uuid not null references public.brands(id) on delete restrict,
  description      text,
  fragrance_family text,
  gender           text not null default 'unisex' check (gender in ('men','women','unisex')),
  top_notes        text[] not null default '{}',
  heart_notes      text[] not null default '{}',
  base_notes       text[] not null default '{}',
  concentration    text,
  main_image_url   text,
  is_featured      boolean not null default false,
  is_new_arrival   boolean not null default false,
  is_bestseller    boolean not null default false,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table if not exists public.product_categories (
  product_id  uuid not null references public.products(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  primary key (product_id, category_id)
);

create table if not exists public.product_images (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid not null references public.products(id) on delete cascade,
  image_url    text not null,
  storage_path text,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now()
);

create table if not exists public.product_variants (
  id                    uuid primary key default gen_random_uuid(),
  product_id            uuid not null references public.products(id) on delete cascade,
  size_label            text not null,
  size_ml               integer not null check (size_ml > 0),
  sku                   text not null unique,
  price_cents           integer not null check (price_cents >= 0),
  compare_at_price_cents integer check (compare_at_price_cents >= 0),
  stock_quantity        integer not null default 0 check (stock_quantity >= 0),
  low_stock_threshold   integer not null default 5 check (low_stock_threshold >= 0),
  is_full_bottle        boolean not null default false,
  is_active             boolean not null default true,
  created_at            timestamptz not null default now(),
  unique (product_id, size_label)
);

create table if not exists public.wishlists (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, product_id)
);

create table if not exists public.carts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null unique references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.cart_items (
  id         uuid primary key default gen_random_uuid(),
  cart_id    uuid not null references public.carts(id) on delete cascade,
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  quantity   integer not null check (quantity > 0),
  created_at timestamptz not null default now(),
  unique (cart_id, variant_id)
);

create table if not exists public.shipping_methods (
  id             uuid primary key default gen_random_uuid(),
  name           text not null unique,
  price_cents    integer not null check (price_cents >= 0),
  estimated_days integer,
  is_active      boolean not null default true
);

create table if not exists public.coupons (
  id              uuid primary key default gen_random_uuid(),
  code            text not null unique,
  discount_type   text not null check (discount_type in ('percentage','fixed')),
  discount_value  integer not null check (discount_value > 0),
  min_order_cents integer not null default 0 check (min_order_cents >= 0),
  starts_at       timestamptz,
  expires_at      timestamptz,
  usage_limit     integer check (usage_limit > 0),
  used_count      integer not null default 0 check (used_count >= 0),
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  check (discount_type <> 'percentage' or discount_value <= 100)
);

create table if not exists public.orders (
  id                   uuid primary key default gen_random_uuid(),
  order_number         text not null unique default public.generate_order_number(),
  user_id              uuid not null references public.profiles(id) on delete restrict,
  status               text not null default 'pending'
                       check (status in ('pending','confirmed','processing','shipped','delivered','cancelled','refunded')),
  payment_status       text not null default 'unpaid'
                       check (payment_status in ('unpaid','paid','refunded')),
  payment_method       text not null default 'cash_on_delivery',
  currency             text not null default 'EUR',
  subtotal_cents       integer not null check (subtotal_cents >= 0),
  discount_cents       integer not null default 0 check (discount_cents >= 0),
  shipping_cents       integer not null default 0 check (shipping_cents >= 0),
  total_cents          integer not null check (total_cents >= 0),
  coupon_code          text,
  shipping_method_name text,
  shipping_address     jsonb not null,
  customer_name        text,
  customer_email       text,
  customer_phone       text,
  notes                text,
  idempotency_key      text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (user_id, idempotency_key)
);

create table if not exists public.order_items (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid not null references public.orders(id) on delete cascade,
  product_id       uuid references public.products(id) on delete set null,
  variant_id       uuid references public.product_variants(id) on delete set null,
  product_name     text not null,
  brand_name       text not null,
  size_label       text not null,
  sku              text not null,
  unit_price_cents integer not null check (unit_price_cents >= 0),
  quantity         integer not null check (quantity > 0),
  line_total_cents integer not null check (line_total_cents >= 0)
);

create table if not exists public.reviews (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles(id) on delete cascade,
  product_id        uuid not null references public.products(id) on delete cascade,
  rating            integer not null check (rating between 1 and 5),
  title             text,
  body              text,
  verified_purchase boolean not null default false,
  is_approved       boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (user_id, product_id)
);

create table if not exists public.ai_recommendations (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null references public.profiles(id) on delete cascade,
  preferences             jsonb not null default '{}',
  recommended_product_ids uuid[] not null default '{}',
  explanation             text,
  created_at              timestamptz not null default now()
);

-- ---------- Indeksi ----------
create unique index if not exists addresses_one_default_per_user
  on public.addresses (user_id) where is_default;
create index if not exists idx_addresses_user      on public.addresses (user_id);
create index if not exists idx_products_brand      on public.products (brand_id);
create index if not exists idx_products_active     on public.products (is_active);
create index if not exists idx_product_cat_cat     on public.product_categories (category_id);
create index if not exists idx_product_images_prod on public.product_images (product_id);
create index if not exists idx_variants_product    on public.product_variants (product_id);
create index if not exists idx_wishlists_user      on public.wishlists (user_id);
create index if not exists idx_cart_items_cart     on public.cart_items (cart_id);
create index if not exists idx_orders_user         on public.orders (user_id);
create index if not exists idx_orders_status       on public.orders (status);
create index if not exists idx_order_items_order   on public.order_items (order_id);
create index if not exists idx_reviews_product     on public.reviews (product_id);
create index if not exists idx_ai_rec_user         on public.ai_recommendations (user_id);

-- ---------- Triggeri ----------
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger trg_products_updated before update on public.products
  for each row execute function public.set_updated_at();
create trigger trg_orders_updated before update on public.orders
  for each row execute function public.set_updated_at();
create trigger trg_reviews_updated before update on public.reviews
  for each row execute function public.set_updated_at();

-- Automatski profil pri registraciji
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, phone)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'phone'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Kreiranje narudžbe (jedna transakcija) ----------
create or replace function public.create_order_from_cart(
  p_user_id            uuid,
  p_shipping_address   jsonb,
  p_shipping_method_id uuid,
  p_coupon_code        text,
  p_notes              text,
  p_idempotency_key    text
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order       public.orders;
  v_cart_id     uuid;
  v_profile     public.profiles;
  v_coupon      public.coupons;
  v_ship_name   text;
  v_ship_price  integer;
  v_subtotal    integer := 0;
  v_discount    integer := 0;
  v_items_count integer := 0;
  v_item        record;
begin
  -- 1) Idempotentnost: ista narudžba se ne pravi dvaput
  if p_idempotency_key is not null then
    select * into v_order
    from public.orders
    where user_id = p_user_id and idempotency_key = p_idempotency_key;
    if found then
      return v_order;
    end if;
  end if;

  -- 2) Korpa
  select id into v_cart_id from public.carts where user_id = p_user_id;
  if v_cart_id is null then
    raise exception 'CART_EMPTY: Korpa je prazna';
  end if;

  -- 3) Zaključaj varijante, provjeri zalihe, izračunaj iznos iz baze
  for v_item in
    select ci.quantity,
           v.price_cents,
           v.stock_quantity,
           v.size_label,
           v.is_active as variant_active,
           p.is_active as product_active,
           p.name      as product_name
    from public.cart_items ci
    join public.product_variants v on v.id = ci.variant_id
    join public.products p         on p.id = v.product_id
    where ci.cart_id = v_cart_id
    order by v.id
    for update of v
  loop
    v_items_count := v_items_count + 1;

    if not v_item.variant_active or not v_item.product_active then
      raise exception 'ITEM_UNAVAILABLE: "%" (%) vise nije dostupan',
        v_item.product_name, v_item.size_label;
    end if;

    if v_item.stock_quantity < v_item.quantity then
      raise exception 'INSUFFICIENT_STOCK: Nema dovoljno zaliha za "%" (%). Dostupno: %',
        v_item.product_name, v_item.size_label, v_item.stock_quantity;
    end if;

    v_subtotal := v_subtotal + v_item.price_cents * v_item.quantity;
  end loop;

  if v_items_count = 0 then
    raise exception 'CART_EMPTY: Korpa je prazna';
  end if;

  -- 4) Dostava
  select name, price_cents into v_ship_name, v_ship_price
  from public.shipping_methods
  where id = p_shipping_method_id and is_active;
  if not found then
    raise exception 'INVALID_SHIPPING: Izabrana metoda dostave ne postoji';
  end if;

  -- 5) Kupon (opciono)
  if p_coupon_code is not null and length(trim(p_coupon_code)) > 0 then
    select * into v_coupon
    from public.coupons
    where upper(code) = upper(trim(p_coupon_code))
    for update;

    if not found or not v_coupon.is_active then
      raise exception 'INVALID_COUPON: Kupon ne postoji ili nije aktivan';
    end if;
    if v_coupon.starts_at is not null and v_coupon.starts_at > now() then
      raise exception 'INVALID_COUPON: Kupon jos nije aktivan';
    end if;
    if v_coupon.expires_at is not null and v_coupon.expires_at <= now() then
      raise exception 'INVALID_COUPON: Kupon je istekao';
    end if;
    if v_coupon.usage_limit is not null and v_coupon.used_count >= v_coupon.usage_limit then
      raise exception 'INVALID_COUPON: Kupon je iskoristen maksimalan broj puta';
    end if;
    if v_subtotal < v_coupon.min_order_cents then
      raise exception 'INVALID_COUPON: Iznos narudzbe je ispod minimuma za ovaj kupon';
    end if;

    if v_coupon.discount_type = 'percentage' then
      v_discount := floor(v_subtotal * v_coupon.discount_value / 100.0)::integer;
    else
      v_discount := v_coupon.discount_value;
    end if;
    v_discount := least(v_discount, v_subtotal);
  end if;

  -- 6) Narudžba
  select * into v_profile from public.profiles where id = p_user_id;

  insert into public.orders (
    user_id, status, payment_status, payment_method,
    subtotal_cents, discount_cents, shipping_cents, total_cents,
    coupon_code, shipping_method_name, shipping_address,
    customer_name, customer_email, customer_phone, notes, idempotency_key
  ) values (
    p_user_id, 'pending', 'unpaid', 'cash_on_delivery',
    v_subtotal, v_discount, v_ship_price, v_subtotal - v_discount + v_ship_price,
    v_coupon.code, v_ship_name, p_shipping_address,
    coalesce(p_shipping_address ->> 'recipient_name', v_profile.full_name),
    v_profile.email,
    coalesce(p_shipping_address ->> 'phone', v_profile.phone),
    p_notes, p_idempotency_key
  )
  returning * into v_order;

  -- 7) Stavke narudžbe (snapshot)
  insert into public.order_items (
    order_id, product_id, variant_id, product_name, brand_name,
    size_label, sku, unit_price_cents, quantity, line_total_cents
  )
  select v_order.id, p.id, v.id, p.name, b.name,
         v.size_label, v.sku, v.price_cents, ci.quantity, v.price_cents * ci.quantity
  from public.cart_items ci
  join public.product_variants v on v.id = ci.variant_id
  join public.products p         on p.id = v.product_id
  join public.brands b           on b.id = p.brand_id
  where ci.cart_id = v_cart_id;

  -- 8) Smanji zalihe
  update public.product_variants v
  set stock_quantity = v.stock_quantity - ci.quantity
  from public.cart_items ci
  where ci.cart_id = v_cart_id and ci.variant_id = v.id;

  -- 9) Kupon i korpa
  if v_coupon.id is not null then
    update public.coupons set used_count = used_count + 1 where id = v_coupon.id;
  end if;

  delete from public.cart_items where cart_id = v_cart_id;

  return v_order;
end;
$$;

-- ---------- Row Level Security ----------
alter table public.profiles           enable row level security;
alter table public.addresses          enable row level security;
alter table public.brands             enable row level security;
alter table public.categories         enable row level security;
alter table public.products           enable row level security;
alter table public.product_categories enable row level security;
alter table public.product_images     enable row level security;
alter table public.product_variants   enable row level security;
alter table public.wishlists          enable row level security;
alter table public.carts              enable row level security;
alter table public.cart_items         enable row level security;
alter table public.shipping_methods   enable row level security;
alter table public.coupons            enable row level security;
alter table public.orders             enable row level security;
alter table public.order_items        enable row level security;
alter table public.reviews            enable row level security;
alter table public.ai_recommendations enable row level security;

-- Javno čitanje samo aktivnih podataka
create policy "brands_public_read" on public.brands
  for select using (is_active);
create policy "categories_public_read" on public.categories
  for select using (is_active);
create policy "products_public_read" on public.products
  for select using (is_active);
create policy "product_categories_public_read" on public.product_categories
  for select using (exists (
    select 1 from public.products p
    where p.id = product_categories.product_id and p.is_active));
create policy "product_images_public_read" on public.product_images
  for select using (exists (
    select 1 from public.products p
    where p.id = product_images.product_id and p.is_active));
create policy "variants_public_read" on public.product_variants
  for select using (is_active and exists (
    select 1 from public.products p
    where p.id = product_variants.product_id and p.is_active));
create policy "shipping_public_read" on public.shipping_methods
  for select using (is_active);

-- Korisnik vidi i mijenja samo svoje podatke
create policy "profiles_select_own" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "addresses_own" on public.addresses
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "wishlists_own" on public.wishlists
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "carts_own" on public.carts
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "cart_items_own" on public.cart_items
  for all to authenticated
  using (exists (select 1 from public.carts c
                 where c.id = cart_items.cart_id and c.user_id = (select auth.uid())))
  with check (exists (select 1 from public.carts c
                 where c.id = cart_items.cart_id and c.user_id = (select auth.uid())));

create policy "orders_select_own" on public.orders
  for select to authenticated using (user_id = (select auth.uid()));

create policy "order_items_select_own" on public.order_items
  for select to authenticated
  using (exists (select 1 from public.orders o
                 where o.id = order_items.order_id and o.user_id = (select auth.uid())));

create policy "reviews_select" on public.reviews
  for select using (is_approved or user_id = (select auth.uid()));
create policy "reviews_insert_own" on public.reviews
  for insert to authenticated
  with check (user_id = (select auth.uid()) and is_approved = false and verified_purchase = false);
create policy "reviews_update_own" on public.reviews
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "reviews_delete_own" on public.reviews
  for delete to authenticated using (user_id = (select auth.uid()));

create policy "ai_rec_select_own" on public.ai_recommendations
  for select to authenticated using (user_id = (select auth.uid()));
create policy "ai_rec_insert_own" on public.ai_recommendations
  for insert to authenticated with check (user_id = (select auth.uid()));

-- coupons: bez policy-ja = nedostupno klijentima (samo backend sa secret ključem)

-- ---------- Privilegije ----------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

grant usage on schema public to anon, authenticated, service_role;
grant all on all tables    in schema public to service_role;
grant all on all sequences in schema public to service_role;

grant select on public.brands, public.categories, public.products,
                public.product_categories, public.product_images,
                public.product_variants, public.shipping_methods
  to anon, authenticated;

grant select on public.profiles to authenticated;
grant update (full_name, phone, avatar_url) on public.profiles to authenticated;

grant select, insert, update, delete on public.addresses to authenticated;
grant select, insert, delete         on public.wishlists to authenticated;
grant select, insert                 on public.carts to authenticated;
grant select, insert, update, delete on public.cart_items to authenticated;
grant select on public.orders, public.order_items to authenticated;

grant select, insert, delete on public.reviews to anon, authenticated;
revoke insert, delete on public.reviews from anon;
grant update (rating, title, body) on public.reviews to authenticated;

grant select, insert on public.ai_recommendations to authenticated;

-- Funkciju za narudžbe smije zvati samo backend
revoke all on function public.create_order_from_cart(uuid, jsonb, uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.create_order_from_cart(uuid, jsonb, uuid, text, text, text)
  to service_role;