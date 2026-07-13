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

create table if not exists public.push_subscriptions (
  endpoint text primary key,
  user_id text not null,
  role text not null check (role in ('director', 'employee')),
  group_code text not null,
  subscription jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.push_events (
  event_key text primary key,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;
alter table public.push_events enable row level security;

drop policy if exists "public read push subscriptions" on public.push_subscriptions;
drop policy if exists "public write push subscriptions" on public.push_subscriptions;
drop policy if exists "public read push events" on public.push_events;
drop policy if exists "public write push events" on public.push_events;

create policy "public read push subscriptions" on public.push_subscriptions for select using (true);
create policy "public write push subscriptions" on public.push_subscriptions for all using (true) with check (true);
create policy "public read push events" on public.push_events for select using (true);
create policy "public write push events" on public.push_events for all using (true) with check (true);
