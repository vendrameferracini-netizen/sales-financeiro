create table if not exists public.carriers (
  id text primary key,
  name text not null,
  ml numeric not null default 0,
  shopee numeric not null default 0,
  avulso numeric not null default 0,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.daily_entries (
  date text primary key,
  carriers jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.fixed_costs (
  id text primary key,
  description text not null,
  category text not null,
  amount numeric not null default 0,
  fortnight text not null check (fortnight in ('first', 'second')),
  month text not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_login (
  id uuid primary key default gen_random_uuid(),
  login text not null unique,
  senha_hash text not null,
  criado_em timestamptz not null default now()
);

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
using (true)
with check (true);

create policy "sales_financeiro_daily_entries_access"
on public.daily_entries for all
using (true)
with check (true);

create policy "sales_financeiro_fixed_costs_access"
on public.fixed_costs for all
using (true)
with check (true);

create policy "sales_financeiro_app_login_select"
on public.app_login for select
to anon
using (true);

create policy "sales_financeiro_app_login_update"
on public.app_login for update
to anon
using (true)
with check (true);

insert into public.app_login (login, senha_hash)
values ('salesfinanceiro', '$2b$10$diNmq41w674gTHAflBBqWegjR/T9QxF3Mg9k2jC4ZMIhvoQ2HV3EC')
on conflict (login) do nothing;
