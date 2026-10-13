-- =============================================================================
-- OPTIONAL sample catalogue, so the site is not empty on first run.
-- Run AFTER the migration. Safe to re-run. Skip it (or archive these outfits
-- from Admin → Outfits) once you add your real collection.
-- Photos are not included: upload them from Admin → Outfits → Edit.
-- =============================================================================

with sample (category_slug, name, slug, description, price, featured) as (
  values
    ('evening-gowns', 'Black Evening Gown', 'black-evening-gown',
     'A floor-length black gown with a sculpted bodice and a soft, flowing skirt. Timeless, flattering, and made for formal nights.',
     1800, true),
    ('evening-gowns', 'Burgundy Velvet Gown', 'burgundy-velvet-gown',
     'Deep burgundy velvet with an off-shoulder neckline and a gentle train. Rich, warm and unmistakably elegant.',
     2200, true),
    ('cocktail-dresses', 'Champagne Cocktail Dress', 'champagne-cocktail-dress',
     'A knee-length champagne satin dress with a wrap waist. Polished enough for a wedding, easy enough to dance in.',
     1200, true),
    ('filipiniana', 'Modern Terno in Ivory', 'modern-terno-ivory',
     'Classic butterfly sleeves on a clean, contemporary silhouette. Hand-finished details in ivory piña-inspired fabric.',
     2500, true),
    ('suits-tuxedos', 'Classic Black Tuxedo', 'classic-black-tuxedo',
     'A sharp two-piece tuxedo with satin peak lapels. Includes jacket and trousers.',
     1500, false),
    ('suits-tuxedos', 'Navy Three-Piece Suit', 'navy-three-piece-suit',
     'Tailored navy suit with a matching waistcoat. A confident choice for weddings and formal events.',
     1600, false),
    ('bridal-entourage', 'Blush Bridesmaid Dress', 'blush-bridesmaid-dress',
     'Soft blush chiffon with a convertible neckline that flatters every member of the entourage.',
     900, false),
    ('debut-prom', 'Rose Gold Ball Gown', 'rose-gold-ball-gown',
     'A full tulle skirt with a shimmering rose gold bodice. A true entrance-maker for debuts and prom night.',
     2800, false)
)
insert into public.outfits (category_id, name, slug, description, rental_price, is_featured)
select c.id, s.name, s.slug, s.description, s.price, s.featured
from sample s
join public.categories c on c.slug = s.category_slug
on conflict (slug) do nothing;

with stock (outfit_slug, size, color) as (
  values
    ('black-evening-gown', 'S', 'Black'), ('black-evening-gown', 'M', 'Black'), ('black-evening-gown', 'L', 'Black'),
    ('burgundy-velvet-gown', 'S', 'Burgundy'), ('burgundy-velvet-gown', 'M', 'Burgundy'),
    ('champagne-cocktail-dress', 'S', 'Champagne'), ('champagne-cocktail-dress', 'M', 'Champagne'), ('champagne-cocktail-dress', 'L', 'Champagne'),
    ('modern-terno-ivory', 'S', 'Ivory'), ('modern-terno-ivory', 'M', 'Ivory'),
    ('classic-black-tuxedo', '38', 'Black'), ('classic-black-tuxedo', '40', 'Black'), ('classic-black-tuxedo', '42', 'Black'),
    ('navy-three-piece-suit', '38', 'Navy'), ('navy-three-piece-suit', '40', 'Navy'),
    ('blush-bridesmaid-dress', 'S', 'Blush'), ('blush-bridesmaid-dress', 'M', 'Blush'), ('blush-bridesmaid-dress', 'L', 'Blush'),
    ('rose-gold-ball-gown', 'S', 'Rose Gold'), ('rose-gold-ball-gown', 'M', 'Rose Gold')
)
insert into public.outfit_variants (outfit_id, size, color)
select o.id, st.size, st.color
from stock st
join public.outfits o on o.slug = st.outfit_slug
on conflict (outfit_id, size, color) do nothing;
