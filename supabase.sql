-- FORGE accounts: one row per user holding their diary as JSON.
-- Row-level security means each signed-in person can only read and change their own row.
create table if not exists public.user_data (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint data_size check (pg_column_size(data) < 2000000) -- about 2 MB, years of logging
);

alter table public.user_data enable row level security;

create policy "read own data" on public.user_data for select to authenticated using (auth.uid() = user_id);
create policy "add own data" on public.user_data for insert to authenticated with check (auth.uid() = user_id);
create policy "update own data" on public.user_data for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own data" on public.user_data for delete to authenticated using (auth.uid() = user_id);

-- Newer Supabase projects do not expose new tables automatically; let signed-in users reach it (the policies above still limit them to their own row).
grant select, insert, update, delete on public.user_data to authenticated;

-- Shared campus menus: one row per day. Any signed-in user can read them, and anyone who runs the
-- weekly import updates them for the whole group. Only near-term days can be written; old days can be cleaned up.
create table if not exists public.menus (
  date date primary key,
  items jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid() references auth.users (id) on delete set null,
  constraint menu_size check (pg_column_size(items) < 1500000)
);
alter table public.menus enable row level security;
create policy "read menus" on public.menus for select to authenticated using (true);
create policy "add menus" on public.menus for insert to authenticated with check (date between current_date - 1 and current_date + 14);
create policy "update menus" on public.menus for update to authenticated using (true) with check (date between current_date - 1 and current_date + 14);
create policy "clean old menus" on public.menus for delete to authenticated using (date < current_date - 1);
grant select, insert, update, delete on public.menus to authenticated;
