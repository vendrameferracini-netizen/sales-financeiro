begin;

delete from public.package_entries
where carrier_id in (
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

delete from public.carriers
where company_id = '11111111-1111-1111-1111-111111111111'
and lower(trim(name)) in (
  'chama log',
  'j.a',
  '3as',
  'expresso',
  'anjun',
  'bras',
  'pomo',
  'mg',
  'gbl',
  'm10',
  'espll',
  'rm',
  'dx',
  'mt',
  'movi'
)
and not exists (
  select 1
  from public.package_entries entries
  where entries.carrier_id = public.carriers.id
);

commit;
