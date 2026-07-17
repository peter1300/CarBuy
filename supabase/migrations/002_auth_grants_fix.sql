-- Fix grants + harden signup trigger (run in Supabase SQL Editor if listings/auth fail)

grant usage on schema public to anon, authenticated, service_role;

grant select on table public.profiles to anon, authenticated;
grant insert, update on table public.profiles to authenticated;
grant all on table public.profiles to service_role;

grant select on table public.listings to anon, authenticated;
grant insert, update, delete on table public.listings to authenticated;
grant all on table public.listings to service_role;

grant select on table public.listing_views to authenticated;
grant insert on table public.listing_views to anon, authenticated;
grant all on table public.listing_views to service_role;

-- Safer signup trigger: invalid account_type must not abort auth.users insert
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account_type text;
begin
  v_account_type := coalesce(new.raw_user_meta_data->>'account_type', 'personal');
  if v_account_type not in ('personal', 'business') then
    v_account_type := 'personal';
  end if;

  insert into public.profiles (id, name, email, account_type, company_name)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'name', ''), split_part(new.email, '@', 1), 'Felhasználó'),
    coalesce(new.email, ''),
    v_account_type,
    nullif(new.raw_user_meta_data->>'company_name', '')
  )
  on conflict (id) do update set
    name = excluded.name,
    email = excluded.email,
    account_type = excluded.account_type,
    company_name = excluded.company_name,
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Re-assert RLS policies (idempotent)
alter table public.profiles enable row level security;
alter table public.listings enable row level security;
alter table public.listing_views enable row level security;

drop policy if exists "Profiles are publicly readable" on public.profiles;
create policy "Profiles are publicly readable"
  on public.profiles for select
  using (true);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "Listings are publicly readable" on public.listings;
create policy "Listings are publicly readable"
  on public.listings for select
  using (true);

drop policy if exists "Users can insert own listings" on public.listings;
create policy "Users can insert own listings"
  on public.listings for insert
  with check (auth.uid() = owner_id and is_demo = false);

drop policy if exists "Users can update own listings" on public.listings;
create policy "Users can update own listings"
  on public.listings for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

drop policy if exists "Users can delete own listings" on public.listings;
create policy "Users can delete own listings"
  on public.listings for delete
  using (auth.uid() = owner_id);

drop policy if exists "Anyone can insert listing views" on public.listing_views;
create policy "Anyone can insert listing views"
  on public.listing_views for insert
  with check (true);

drop policy if exists "Owners can read views for their listings" on public.listing_views;
create policy "Owners can read views for their listings"
  on public.listing_views for select
  using (
    exists (
      select 1 from public.listings l
      where l.id = listing_id and l.owner_id = auth.uid()
    )
  );

grant execute on function public.record_unique_view(text, text) to anon, authenticated;
