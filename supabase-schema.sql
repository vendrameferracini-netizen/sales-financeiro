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

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.carriers enable row level security;
alter table public.daily_entries enable row level security;
alter table public.fixed_costs enable row level security;
alter table public.app_settings enable row level security;

drop policy if exists "sales_financeiro_carriers_access" on public.carriers;
drop policy if exists "sales_financeiro_daily_entries_access" on public.daily_entries;
drop policy if exists "sales_financeiro_fixed_costs_access" on public.fixed_costs;
drop policy if exists "sales_financeiro_app_settings_access" on public.app_settings;

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

create policy "sales_financeiro_app_settings_access"
on public.app_settings for all
using (true)
with check (true);
