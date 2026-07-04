insert into public.companies (id, name)
values ('22222222-2222-2222-2222-222222222222', 'Sales Financeiro')
on conflict (id) do nothing;
