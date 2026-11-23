Izgled aplikacije: https://www.figma.com/make/Kttq8Mzvsn03OiJZVOERed/Untitled?t=rz9T6SilpV7oTv0O-1



# DEKANTCE API

REST API for the DEKANTCE perfume-decant shop. The backend is Node.js, Express, and Supabase; Supabase PostgreSQL is the only database. Prices and order totals are integer cents, and checkout is cash on delivery.

## Project layout

```text
mapp-backend/
  database/                 Existing schema.sql and seed.sql (do not regenerate)
  postman/                  Importable API collection
  src/
    app.js                  Express middleware and route registration
    config/                 Environment validation and Supabase clients
    controllers/            Request/response adapters
    middleware/             Authentication, authorization, validation, errors
    routes/                 Resource routers
    services/               Business rules and all Supabase queries
    utils/                  ApiError
    validators/             Zod request schemas
  index.js                  Starts the HTTP server
```

## Setup

1. Use Node.js 18 or newer.
2. From `mapp-backend`, run `npm install`.
3. Copy `.env.example` to `.env` and set `PORT`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`. Never commit `.env`; the service-role key stays on the server.
4. The Supabase database, `database/schema.sql`, `database/seed.sql`, and public `product-images` bucket are assumed to exist. This API does not create or alter the database schema.
5. Promote a trusted account to administrator in the Supabase SQL editor:

   ```sql
   UPDATE public.profiles SET role = 'admin' WHERE email = 'admin@example.com';
   ```

6. Start the API with `npm run dev` or `npm start`. The default port is 3000; health check: `GET /api/health`.
7. Import `postman/DEKANTCE.postman_collection.json` into Postman. Set `baseUrl` (for example `http://localhost:3000/api`), then register/login. Login stores `token`; set `adminToken` after logging in as an admin. Replace example UUIDs in requests with IDs from your seeded database or earlier responses.

All responses use `{ "success": true, "data": ... }` or `{ "success": false, "message": "...", "errors": [...] }`. Admin resources require both a valid Bearer token and `profiles.role = 'admin'`. User-owned data is always scoped to the authenticated user. Only password login and reset use the anon client; all table access uses the server-only admin client.

## Endpoint reference

`Auth` means a Bearer access token. `Admin` means a Bearer token with the admin profile role. All endpoints validate request bodies, query strings, and path parameters with Zod as applicable.

| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/api/health` | Public | Health check |
| POST | `/api/auth/register` | Public | Register; profile is populated by the existing database trigger |
| POST | `/api/auth/login` | Public | Sign in and receive tokens/profile |
| POST | `/api/auth/logout` | Auth | Revoke current access token |
| POST | `/api/auth/refresh` | Public | Refresh session tokens |
| POST | `/api/auth/forgot-password` | Public | Request password-reset email |
| GET | `/api/auth/me` | Auth | Current profile |
| GET, PATCH | `/api/profile` | Auth | Read/update own profile |
| GET, POST | `/api/addresses` | Auth | List/create own addresses |
| PUT, DELETE | `/api/addresses/:id` | Auth | Replace/delete own address |
| PATCH | `/api/addresses/:id/default` | Auth | Set own default address |
| GET | `/api/brands`, `/api/brands/:slug` | Public | Active brands and brand detail |
| GET | `/api/categories` | Public | Active categories |
| GET | `/api/products` | Public | Filtered, sorted, paginated active catalog |
| GET | `/api/products/:idOrSlug` | Public | Product, categories, variants, gallery, review summary |
| GET | `/api/products/:idOrSlug/reviews` | Public | Approved product reviews, paginated |
| GET, POST, PUT, PATCH, DELETE | `/api/admin/brands[/:id]` | Admin | Brand CRUD |
| GET, POST, PUT, PATCH, DELETE | `/api/admin/categories[/:id]` | Admin | Category CRUD |
| GET, POST | `/api/admin/products` | Admin | List all products / create product with categories and variants |
| PUT | `/api/admin/products/:id` | Admin | Update product fields and category links |
| PATCH | `/api/admin/products/:id/status` | Admin | Activate/deactivate product |
| DELETE | `/api/admin/products/:id` | Admin | Delete or soft-delete a product referenced by orders |
| POST | `/api/admin/products/:id/variants` | Admin | Add product variant |
| PUT, DELETE | `/api/admin/variants/:id` | Admin | Update/delete variant |
| PATCH | `/api/admin/variants/:id/stock` | Admin | Set variant stock |
| POST | `/api/admin/products/:id/image` | Admin | Replace product main image (multipart `image`) |
| POST | `/api/admin/products/:id/gallery` | Admin | Add gallery image (multipart `image`) |
| DELETE | `/api/admin/products/:id/gallery/:imageId` | Admin | Delete gallery row and stored file |
| GET, POST, DELETE | `/api/wishlist[/:productId]` | Auth | Read/add/remove own wishlist entries |
| GET, DELETE | `/api/cart` | Auth | Read or clear own cart |
| POST | `/api/cart/items` | Auth | Add/merge cart item with stock validation |
| PATCH, DELETE | `/api/cart/items/:itemId` | Auth | Update/remove own cart item |
| GET | `/api/shipping-methods` | Public | Active shipping methods |
| POST | `/api/coupons/validate` | Auth | Validate a coupon against the server-calculated cart subtotal |
| GET, POST, PUT, PATCH, DELETE | `/api/admin/coupons[/:id]` | Admin | Coupon CRUD |
| GET, POST, PUT, PATCH, DELETE | `/api/admin/shipping-methods[/:id]` | Admin | Shipping-method CRUD |
| POST, GET | `/api/orders` | Auth | Create order from cart / list own paginated orders |
| GET | `/api/orders/:id` | Auth | Read own order and items |
| PATCH | `/api/orders/:id/cancel` | Auth | Cancel eligible own order and restore stock |
| GET | `/api/admin/orders` | Admin | Filtered, paginated order list |
| GET | `/api/admin/orders/:id` | Admin | Order, items, and customer |
| PATCH | `/api/admin/orders/:id/status` | Admin | Advance order status or cancel and restore stock |
| PATCH | `/api/admin/orders/:id/payment-status` | Admin | Update payment status |
| PUT, DELETE | `/api/admin/orders/:id` | Admin | Edit eligible order / delete cancelled order |
| GET | `/api/admin/stats` | Admin | Order/revenue/status and low-stock summary |
| POST | `/api/products/:id/reviews` | Auth | Submit one unapproved review per product |
| PUT, DELETE | `/api/reviews/:id` | Auth | Update/delete own review |
| GET | `/api/admin/reviews` | Admin | List reviews, optionally filter approval |
| PATCH | `/api/admin/reviews/:id/approve` | Admin | Approve review |
| DELETE | `/api/admin/reviews/:id` | Admin | Delete review |
| POST | `/api/recommendations` | Optional Auth | Deterministic recommendations; save when signed in |
| GET | `/api/recommendations/history` | Auth | Own recommendation history |

Orders are created through `create_order_from_cart`; repeated `idempotency_key` values return the original order. Cart-empty and invalid-shipping/coupon errors return HTTP 400; unavailable items and insufficient stock return HTTP 409.
