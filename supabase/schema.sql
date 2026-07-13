create table if not exists public.app_groups (
  code text primary key,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.app_records (
  collection text not null,
  id text not null,
  group_code text,
  username text,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (collection, id)
);

create unique index if not exists app_records_unique_username
on public.app_records (collection, username)
where username is not null and collection in ('employees', 'directors');

alter table public.app_groups enable row level security;
alter table public.app_records enable row level security;

drop policy if exists "public read app groups" on public.app_groups;
drop policy if exists "public write app groups" on public.app_groups;
drop policy if exists "public read app records" on public.app_records;
drop policy if exists "public write app records" on public.app_records;

create policy "public read app groups" on public.app_groups for select using (true);
create policy "public write app groups" on public.app_groups for all using (true) with check (true);
create policy "public read app records" on public.app_records for select using (true);
create policy "public write app records" on public.app_records for all using (true) with check (true);
