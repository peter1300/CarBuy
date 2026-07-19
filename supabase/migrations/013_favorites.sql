-- Favorites: per-user saved listings (also trains recommendations)

create table if not exists public.favorites (
  user_id uuid not null references public.profiles (id) on delete cascade,
  listing_id text not null references public.listings (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);

create index if not exists favorites_user_id_created_at_idx
  on public.favorites (user_id, created_at desc);

create index if not exists favorites_listing_id_idx
  on public.favorites (listing_id);

alter table public.favorites enable row level security;

drop policy if exists "Users can read own favorites" on public.favorites;
create policy "Users can read own favorites"
  on public.favorites for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own favorites" on public.favorites;
create policy "Users can insert own favorites"
  on public.favorites for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own favorites" on public.favorites;
create policy "Users can delete own favorites"
  on public.favorites for delete
  using (auth.uid() = user_id);

grant select, insert, delete on table public.favorites to authenticated;
grant all on table public.favorites to service_role;
