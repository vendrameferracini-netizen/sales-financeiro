-- Schema real utilizado pelo Sales Financeiro:
-- companies
-- carriers
-- daily_entries
-- package_entries
-- fixed_costs
-- costs
-- profiles
-- app_login
--
-- O frontend consulta apenas as tabelas listadas acima.
--
-- Execute ajustes de RLS conforme as colunas reais do seu banco. O app
-- usa a anon key pelo client oficial do Supabase e espera permissao para
-- SELECT/INSERT/UPDATE/DELETE nas tabelas acima.

alter table public.companies enable row level security;
alter table public.carriers enable row level security;
alter table public.daily_entries enable row level security;
alter table public.package_entries enable row level security;
alter table public.fixed_costs enable row level security;
alter table public.costs enable row level security;
alter table public.profiles enable row level security;
alter table public.app_login enable row level security;

drop policy if exists "sales_financeiro_companies_access" on public.companies;
drop policy if exists "sales_financeiro_carriers_access" on public.carriers;
drop policy if exists "sales_financeiro_daily_entries_access" on public.daily_entries;
drop policy if exists "sales_financeiro_package_entries_access" on public.package_entries;
drop policy if exists "sales_financeiro_fixed_costs_access" on public.fixed_costs;
drop policy if exists "sales_financeiro_costs_access" on public.costs;
drop policy if exists "sales_financeiro_profiles_access" on public.profiles;
drop policy if exists "sales_financeiro_app_login_select" on public.app_login;
drop policy if exists "sales_financeiro_app_login_update" on public.app_login;

create policy "sales_financeiro_companies_access"
on public.companies for all
to anon
using (true)
with check (true);

create policy "sales_financeiro_carriers_access"
on public.carriers for all
to anon
using (true)
with check (true);

create policy "sales_financeiro_daily_entries_access"
on public.daily_entries for all
to anon
using (true)
with check (true);

create policy "sales_financeiro_package_entries_access"
on public.package_entries for all
to anon
using (true)
with check (true);

create policy "sales_financeiro_fixed_costs_access"
on public.fixed_costs for all
to anon
using (true)
with check (true);

create policy "sales_financeiro_costs_access"
on public.costs for all
to anon
using (true)
with check (true);

create policy "sales_financeiro_profiles_access"
on public.profiles for all
to anon
using (true)
with check (true);

create policy "sales_financeiro_app_login_select"
on public.app_login for select
to anon
using (app_id = 'sales_financeiro');

create policy "sales_financeiro_app_login_update"
on public.app_login for update
to anon
using (app_id = 'sales_financeiro')
with check (app_id = 'sales_financeiro');
