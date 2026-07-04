-- FINANCEIRO SALLES
-- Schema limpo para um projeto Supabase exclusivo do Sales Financeiro.
-- Execute este arquivo somente em um projeto Supabase novo, separado de outros apps.

create extension if not exists pgcrypto;

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  app_id text not null default 'sales_financeiro',
  name text not null,
  status text not null default 'ativo' check (status in ('ativo', 'inativo')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.carriers (
  id uuid primary key default gen_random_uuid(),
  app_id text not null default 'sales_financeiro',
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  ml numeric(12, 2) not null default 0,
  shopee numeric(12, 2) not null default 0,
  avulso numeric(12, 2) not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.daily_entries (
  id uuid primary key default gen_random_uuid(),
  app_id text not null default 'sales_financeiro',
  company_id uuid not null references public.companies(id) on delete cascade,
  date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (app_id, company_id, date)
);

create table if not exists public.package_entries (
  id uuid primary key default gen_random_uuid(),
  app_id text not null default 'sales_financeiro',
  company_id uuid not null references public.companies(id) on delete cascade,
  daily_entry_id uuid not null references public.daily_entries(id) on delete cascade,
  carrier_id uuid not null references public.carriers(id) on delete restrict,
  ml integer not null default 0,
  shopee integer not null default 0,
  avulso integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fixed_costs (
  id uuid primary key default gen_random_uuid(),
  app_id text not null default 'sales_financeiro',
  company_id uuid not null references public.companies(id) on delete cascade,
  description text not null,
  category text not null default 'Geral',
  amount numeric(12, 2) not null default 0,
  fortnight text not null check (fortnight in ('first', 'second')),
  month text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.costs (
  id uuid primary key default gen_random_uuid(),
  app_id text not null default 'sales_financeiro',
  company_id uuid not null references public.companies(id) on delete cascade,
  description text not null,
  category text not null default 'Geral',
  amount numeric(12, 2) not null default 0,
  fortnight text not null check (fortnight in ('first', 'second')),
  month text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  app_id text not null default 'sales_financeiro',
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  email text,
  role text not null default 'admin',
  last_signed_in timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.app_login (
  id uuid primary key default gen_random_uuid(),
  app_id text not null default 'sales_financeiro',
  login text not null,
  senha_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (app_id, login)
);

create index if not exists carriers_sales_scope_idx on public.carriers(app_id, company_id, name);
create index if not exists daily_entries_sales_scope_idx on public.daily_entries(app_id, company_id, date);
create index if not exists package_entries_sales_scope_idx on public.package_entries(app_id, company_id, daily_entry_id, carrier_id);
create index if not exists fixed_costs_sales_scope_idx on public.fixed_costs(app_id, company_id, month, fortnight);
create index if not exists costs_sales_scope_idx on public.costs(app_id, company_id, month, fortnight);

insert into public.companies (id, app_id, name, status)
values ('11111111-1111-1111-1111-111111111111', 'sales_financeiro', 'Sales Financeiro', 'ativo')
on conflict (id) do update
set app_id = excluded.app_id,
    name = excluded.name,
    status = excluded.status,
    updated_at = now();

insert into public.app_login (app_id, login, senha_hash)
values ('sales_financeiro', 'salesfinanceiro', crypt('Sales123', gen_salt('bf', 10)))
on conflict (app_id, login) do nothing;

alter table public.companies enable row level security;
alter table public.carriers enable row level security;
alter table public.daily_entries enable row level security;
alter table public.package_entries enable row level security;
alter table public.fixed_costs enable row level security;
alter table public.costs enable row level security;
alter table public.profiles enable row level security;
alter table public.app_login enable row level security;

drop policy if exists "sales_companies_access" on public.companies;
drop policy if exists "sales_carriers_access" on public.carriers;
drop policy if exists "sales_daily_entries_access" on public.daily_entries;
drop policy if exists "sales_package_entries_access" on public.package_entries;
drop policy if exists "sales_fixed_costs_access" on public.fixed_costs;
drop policy if exists "sales_costs_access" on public.costs;
drop policy if exists "sales_profiles_access" on public.profiles;
drop policy if exists "sales_app_login_select" on public.app_login;
drop policy if exists "sales_app_login_update" on public.app_login;

create policy "sales_companies_access"
on public.companies for all
to anon
using (app_id = 'sales_financeiro')
with check (app_id = 'sales_financeiro');

create policy "sales_carriers_access"
on public.carriers for all
to anon
using (app_id = 'sales_financeiro')
with check (app_id = 'sales_financeiro');

create policy "sales_daily_entries_access"
on public.daily_entries for all
to anon
using (app_id = 'sales_financeiro')
with check (app_id = 'sales_financeiro');

create policy "sales_package_entries_access"
on public.package_entries for all
to anon
using (app_id = 'sales_financeiro')
with check (app_id = 'sales_financeiro');

create policy "sales_fixed_costs_access"
on public.fixed_costs for all
to anon
using (app_id = 'sales_financeiro')
with check (app_id = 'sales_financeiro');

create policy "sales_costs_access"
on public.costs for all
to anon
using (app_id = 'sales_financeiro')
with check (app_id = 'sales_financeiro');

create policy "sales_profiles_access"
on public.profiles for all
to anon
using (app_id = 'sales_financeiro')
with check (app_id = 'sales_financeiro');

create policy "sales_app_login_select"
on public.app_login for select
to anon
using (app_id = 'sales_financeiro');

create policy "sales_app_login_update"
on public.app_login for update
to anon
using (app_id = 'sales_financeiro')
with check (app_id = 'sales_financeiro');
