-- =====================================================
-- DEKANTCE - seed.sql  (pokreni DRUGI, poslije schema.sql)
-- Cijene su u centima (1400 = 14.00)
-- =====================================================

-- Brendovi
insert into public.brands (name, slug, description, country) values
  ('Dior',    'dior',    'Francuska kuća luksuznih parfema.',                'Francuska'),
  ('Creed',   'creed',   'Nišna parfumerija s dugom tradicijom.',            'Velika Britanija'),
  ('Maison Francis Kurkdjian', 'maison-francis-kurkdjian',
                          'Savremena nišna parfumerija iz Pariza.',           'Francuska'),
  ('Lattafa', 'lattafa', 'Popularni arapski parfemi bogatih mirisa.',        'UAE')
on conflict (slug) do nothing;

-- Kategorije
insert into public.categories (name, slug, description) values
  ('Designer', 'designer', 'Poznate dizajnerske kuće'),
  ('Niche',    'niche',    'Ekskluzivni nišni parfemi'),
  ('Arabic',   'arabic',   'Arapski parfemi i oud mirisi'),
  ('Men',      'men',      'Muški parfemi'),
  ('Women',    'women',    'Ženski parfemi'),
  ('Unisex',   'unisex',   'Parfemi za sve')
on conflict (slug) do nothing;

-- Proizvodi
insert into public.products
  (name, slug, brand_id, description, fragrance_family, gender,
   top_notes, heart_notes, base_notes, concentration, main_image_url,
   is_featured, is_new_arrival, is_bestseller)
select v.name, v.slug, b.id, v.description, v.family, v.gender,
       v.top_notes, v.heart_notes, v.base_notes, v.concentration, v.img,
       v.featured, v.new_arrival, v.bestseller
from (values
  ('Sauvage Eau de Parfum', 'dior-sauvage-edp', 'dior',
   'Svjež i aromatičan miris sa bergamotom i biberom, na toploj ambrastoj osnovi.',
   'Aromatična', 'men',
   array['Bergamot','Papar']::text[], array['Lavanda','Sečuanski papar']::text[], array['Ambroksan','Vanila']::text[],
   'Eau de Parfum', 'https://placehold.co/600x800/0B0B0B/C9A66B?text=Sauvage',
   true, false, true),
  ('J''adore Eau de Parfum', 'dior-jadore-edp', 'dior',
   'Elegantan cvjetni buket jasmina i ruže, mekan i ženstven.',
   'Cvjetna', 'women',
   array['Kruška','Bergamot']::text[], array['Jasmin','Ruža']::text[], array['Mošus','Vanila']::text[],
   'Eau de Parfum', 'https://placehold.co/600x800/0B0B0B/C9A66B?text=Jadore',
   true, false, false),
  ('Aventus', 'creed-aventus', 'creed',
   'Moćan voćno-dimljen miris sa ananasom i brezom, simbol uspjeha.',
   'Voćna', 'men',
   array['Ananas','Bergamot','Jabuka']::text[], array['Breza','Jasmin','Pačuli']::text[], array['Mošus','Hrastov mah','Ambra']::text[],
   'Eau de Parfum', 'https://placehold.co/600x800/0B0B0B/C9A66B?text=Aventus',
   true, false, true),
  ('Silver Mountain Water', 'creed-silver-mountain-water', 'creed',
   'Hladan, svjež miris planinske vode, zelenog čaja i crne ribizle.',
   'Svježa', 'unisex',
   array['Bergamot','Mandarina']::text[], array['Zeleni čaj','Crna ribizla']::text[], array['Sandalovina','Mošus']::text[],
   'Eau de Parfum', 'https://placehold.co/600x800/0B0B0B/C9A66B?text=Silver+Mountain',
   false, false, false),
  ('Baccarat Rouge 540', 'mfk-baccarat-rouge-540', 'maison-francis-kurkdjian',
   'Svjetlucav ambrasto-cvjetni miris sa šafranom, prepoznatljiv i luksuzan.',
   'Ambrasta', 'unisex',
   array['Šafran','Jasmin']::text[], array['Ambrasto drvo','Ambergris']::text[], array['Smolasta jela','Cedar']::text[],
   'Eau de Parfum', 'https://placehold.co/600x800/0B0B0B/C9A66B?text=BR540',
   true, false, true),
  ('Aqua Universalis', 'mfk-aqua-universalis', 'maison-francis-kurkdjian',
   'Čist, svjež miris limuna i bijelog mošusa, osjećaj tek opranog platna.',
   'Svježa', 'unisex',
   array['Limun','Bergamot']::text[], array['Đurđica','Jasmin']::text[], array['Mošus']::text[],
   'Eau de Toilette', 'https://placehold.co/600x800/0B0B0B/C9A66B?text=Aqua+Universalis',
   false, true, false),
  ('Khamrah', 'lattafa-khamrah', 'lattafa',
   'Topao gurmanski miris cimeta, urmi i vanile, popularan u hladnijim mjesecima.',
   'Gurmanska', 'unisex',
   array['Cimet','Muškatni oraščić','Bergamot']::text[], array['Urme','Pralina','Bijeli cvjetovi']::text[], array['Vanila','Tonka','Ambrasto drvo']::text[],
   'Eau de Parfum', 'https://placehold.co/600x800/0B0B0B/C9A66B?text=Khamrah',
   true, false, true),
  ('Asad', 'lattafa-asad', 'lattafa',
   'Intenzivan muški miris sa paprom, kafom i vanilom.',
   'Orijentalna', 'men',
   array['Crni papar','List duhana','Ananas']::text[], array['Kafa','Iris','Pačuli']::text[], array['Vanila','Ambra']::text[],
   'Eau de Parfum', 'https://placehold.co/600x800/0B0B0B/C9A66B?text=Asad',
   false, true, false)
) as v(name, slug, brand_slug, description, family, gender,
       top_notes, heart_notes, base_notes, concentration, img,
       featured, new_arrival, bestseller)
join public.brands b on b.slug = v.brand_slug
on conflict (slug) do nothing;

-- Veze proizvod - kategorija
insert into public.product_categories (product_id, category_id)
select p.id, c.id
from (values
  ('dior-sauvage-edp','designer'),   ('dior-sauvage-edp','men'),
  ('dior-jadore-edp','designer'),    ('dior-jadore-edp','women'),
  ('creed-aventus','niche'),         ('creed-aventus','men'),
  ('creed-silver-mountain-water','niche'), ('creed-silver-mountain-water','unisex'),
  ('mfk-baccarat-rouge-540','niche'),('mfk-baccarat-rouge-540','unisex'),
  ('mfk-aqua-universalis','niche'),  ('mfk-aqua-universalis','unisex'),
  ('lattafa-khamrah','arabic'),      ('lattafa-khamrah','unisex'),
  ('lattafa-asad','arabic'),         ('lattafa-asad','men')
) as m(product_slug, category_slug)
join public.products p   on p.slug = m.product_slug
join public.categories c on c.slug = m.category_slug
on conflict do nothing;

-- Varijante: 5 ml, 10 ml, 20 ml i puna bočica
with prices(slug, p5, p10, p20, pfull, full_ml) as (values
  ('dior-sauvage-edp',            1400,  2400,  4200, 12900, 100),
  ('dior-jadore-edp',             1300,  2200,  3900, 11900, 100),
  ('creed-aventus',               3200,  5800, 10500, 36000, 100),
  ('creed-silver-mountain-water', 2800,  5000,  9000, 31000, 100),
  ('mfk-baccarat-rouge-540',      3500,  6300, 11500, 38000,  70),
  ('mfk-aqua-universalis',        1800,  3200,  5800, 19500,  70),
  ('lattafa-khamrah',              600,  1000,  1800,  4500, 100),
  ('lattafa-asad',                 500,   900,  1600,  3800, 100)
),
sizes as (
  select slug, '5 ml'  as size_label, 5  as size_ml, 'DEC5'  as suffix, p5  as price, false as is_full from prices
  union all
  select slug, '10 ml', 10, 'DEC10', p10, false from prices
  union all
  select slug, '20 ml', 20, 'DEC20', p20, false from prices
  union all
  select slug, 'Full bottle', full_ml, 'FULL', pfull, true from prices
)
insert into public.product_variants
  (product_id, size_label, size_ml, sku, price_cents, stock_quantity, low_stock_threshold, is_full_bottle)
select p.id, s.size_label, s.size_ml, upper(s.slug) || '-' || s.suffix,
       s.price, case when s.is_full then 15 else 50 end, 5, s.is_full
from sizes s
join public.products p on p.slug = s.slug
on conflict (sku) do nothing;

-- Metode dostave
insert into public.shipping_methods (name, price_cents, estimated_days) values
  ('Standardna dostava', 500, 4),
  ('Brza dostava',      1000, 2),
  ('Lično preuzimanje',    0, 0)
on conflict (name) do nothing;

-- Kuponi
insert into public.coupons (code, discount_type, discount_value, min_order_cents, usage_limit) values
  ('WELCOME10', 'percentage', 10, 2000, 1000),
  ('SAVE5',     'fixed',     500, 3000, 500)
on conflict (code) do nothing;