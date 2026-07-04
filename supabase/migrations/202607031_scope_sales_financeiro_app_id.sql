alter table public.carriers add column if not exists app_id text;
alter table public.daily_entries add column if not exists app_id text;
alter table public.fixed_costs add column if not exists app_id text;
alter table public.app_login add column if not exists app_id text;

update public.daily_entries set app_id = 'legacy' where app_id is null;
update public.carriers
set app_id = 'sales_financeiro'
where app_id is null
  and (
    id in ('chama-log', 'ja', '3as', 'expresso', 'anjun', 'bras', 'pomo', 'mg', 'gbl', 'm10', 'espll', 'rm', 'dx', 'mt', 'movi')
    or name in ('Chama Log', 'J.A', '3AS', 'Expresso', 'ANJUN', 'Bras', 'POMO', 'MG', 'GBL', 'M10', 'ESPLL', 'RM', 'DX', 'MT', 'Movi')
  );
update public.carriers set app_id = 'legacy' where app_id is null;
update public.fixed_costs set app_id = 'legacy' where app_id is null;
update public.app_login set app_id = 'sales_financeiro' where app_id is null and login = 'salesfinanceiro';
update public.app_login set app_id = 'legacy' where app_id is null;

alter table public.carriers alter column app_id set default 'sales_financeiro';
alter table public.daily_entries alter column app_id set default 'sales_financeiro';
alter table public.fixed_costs alter column app_id set default 'sales_financeiro';
alter table public.app_login alter column app_id set default 'sales_financeiro';

alter table public.carriers drop constraint if exists carriers_pkey;
alter table public.carriers alter column app_id set not null;
alter table public.carriers alter column id set not null;
alter table public.carriers add constraint carriers_pkey primary key (app_id, id);

alter table public.daily_entries drop constraint if exists daily_entries_pkey;
alter table public.daily_entries alter column app_id set not null;
alter table public.daily_entries add constraint daily_entries_pkey primary key (app_id, date);

alter table public.fixed_costs drop constraint if exists fixed_costs_pkey;
alter table public.fixed_costs alter column app_id set not null;
alter table public.fixed_costs alter column id set not null;
alter table public.fixed_costs add constraint fixed_costs_pkey primary key (app_id, id);

alter table public.app_login drop constraint if exists app_login_login_key;
alter table public.app_login alter column app_id set not null;
alter table public.app_login add constraint app_login_app_id_login_key unique (app_id, login);

create index if not exists carriers_app_id_idx on public.carriers (app_id);
create index if not exists fixed_costs_app_id_idx on public.fixed_costs (app_id);

alter table public.carriers enable row level security;
alter table public.daily_entries enable row level security;
alter table public.fixed_costs enable row level security;
alter table public.app_login enable row level security;

drop policy if exists "sales_financeiro_carriers_access" on public.carriers;
drop policy if exists "sales_financeiro_daily_entries_access" on public.daily_entries;
drop policy if exists "sales_financeiro_fixed_costs_access" on public.fixed_costs;
drop policy if exists "sales_financeiro_app_login_select" on public.app_login;
drop policy if exists "sales_financeiro_app_login_update" on public.app_login;

create policy "sales_financeiro_carriers_access"
on public.carriers for all
to anon
using (app_id = 'sales_financeiro')
with check (app_id = 'sales_financeiro');

create policy "sales_financeiro_daily_entries_access"
on public.daily_entries for all
to anon
using (app_id = 'sales_financeiro')
with check (app_id = 'sales_financeiro');

create policy "sales_financeiro_fixed_costs_access"
on public.fixed_costs for all
to anon
using (app_id = 'sales_financeiro')
with check (app_id = 'sales_financeiro');

create policy "sales_financeiro_app_login_select"
on public.app_login for select
to anon
using (app_id = 'sales_financeiro');

create policy "sales_financeiro_app_login_update"
on public.app_login for update
to anon
using (app_id = 'sales_financeiro')
with check (app_id = 'sales_financeiro');

insert into public.app_login (app_id, login, senha_hash)
values ('sales_financeiro', 'salesfinanceiro', '$2b$10$diNmq41w674gTHAflBBqWegjR/T9QxF3Mg9k2jC4ZMIhvoQ2HV3EC')
on conflict (app_id, login) do update
set app_id = excluded.app_id;

insert into public.carriers (app_id, id, name, ml, shopee, avulso, active)
values
  ('sales_financeiro', 'chama-log', 'Chama Log', 9.50, 7.50, 9.50, true),
  ('sales_financeiro', 'ja', 'J.A', 9.50, 7.00, 9.50, true),
  ('sales_financeiro', '3as', '3AS', 10.00, 7.00, 10.00, true),
  ('sales_financeiro', 'expresso', 'Expresso', 10.00, 7.00, 10.00, true),
  ('sales_financeiro', 'anjun', 'ANJUN', 10.00, 7.00, 10.00, true),
  ('sales_financeiro', 'bras', 'Bras', 10.00, 7.00, 10.00, true),
  ('sales_financeiro', 'pomo', 'POMO', 9.50, 7.00, 9.50, true),
  ('sales_financeiro', 'mg', 'MG', 10.00, 7.00, 10.00, true),
  ('sales_financeiro', 'gbl', 'GBL', 10.00, 7.00, 10.00, true),
  ('sales_financeiro', 'm10', 'M10', 10.00, 7.00, 10.00, true),
  ('sales_financeiro', 'espll', 'ESPLL', 10.00, 7.00, 10.00, true),
  ('sales_financeiro', 'rm', 'RM', 10.00, 7.00, 10.00, true),
  ('sales_financeiro', 'dx', 'DX', 10.00, 7.00, 10.00, true),
  ('sales_financeiro', 'mt', 'MT', 10.00, 7.00, 10.00, true),
  ('sales_financeiro', 'movi', 'Movi', 10.00, 7.00, 10.00, true)
on conflict (app_id, id) do nothing;
