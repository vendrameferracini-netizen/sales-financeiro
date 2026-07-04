begin;

delete from public.package_entries
where company_id = '11111111-1111-1111-1111-111111111111'
and carrier_id in (
  select id
  from public.carriers
  where company_id = '11111111-1111-1111-1111-111111111111'
  and lower(trim(name)) in (
    'amanda',
    'antonio',
    'ar4',
    'disk flex',
    'flash-tlg',
    'flash tlg'
  )
);

delete from public.carriers
where company_id = '11111111-1111-1111-1111-111111111111'
and lower(trim(name)) in (
  'amanda',
  'antonio',
  'ar4',
  'disk flex',
  'flash-tlg',
  'flash tlg'
);

insert into public.carriers (id, company_id, name, ml, shopee, avulso, active, updated_at)
select gen_random_uuid(), '11111111-1111-1111-1111-111111111111', seed.name, seed.ml, seed.shopee, seed.avulso, true, now()
from (
  values
    ('Chama Log', 9.50, 7.50, 9.50),
    ('J.A', 9.50, 7.00, 9.50),
    ('3AS', 10.00, 7.00, 10.00),
    ('Expresso', 10.00, 7.00, 10.00),
    ('ANJUN', 10.00, 7.00, 10.00),
    ('Bras', 10.00, 7.00, 10.00),
    ('POMO', 9.50, 7.00, 9.50),
    ('MG', 10.00, 7.00, 10.00),
    ('GBL', 10.00, 7.00, 10.00),
    ('M10', 10.00, 7.00, 10.00),
    ('ESPLL', 10.00, 7.00, 10.00),
    ('RM', 10.00, 7.00, 10.00),
    ('DX', 10.00, 7.00, 10.00),
    ('MT', 10.00, 7.00, 10.00),
    ('Movi', 10.00, 7.00, 10.00)
) as seed(name, ml, shopee, avulso)
where not exists (
  select 1
  from public.carriers existing
  where existing.company_id = '11111111-1111-1111-1111-111111111111'
  and lower(trim(existing.name)) = lower(trim(seed.name))
);

commit;
