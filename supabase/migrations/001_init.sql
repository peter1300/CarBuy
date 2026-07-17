-- CarBuy initial schema: profiles, listings, listing_views, RLS, seed
-- Run in Supabase SQL Editor (Dashboard → SQL → New query)

-- Extensions
create extension if not exists "pgcrypto";

-- Profiles (1:1 with auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  email text not null,
  account_type text not null check (account_type in ('personal', 'business')),
  company_name text,
  seller_status text not null default 'offline'
    check (seller_status in ('online', 'busy', 'offline')),
  rating numeric(2,1) not null default 5.0,
  response_time text not null default '< 5 perc',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Listings
create table if not exists public.listings (
  id text primary key,
  owner_id uuid references public.profiles (id) on delete set null,
  is_demo boolean not null default false,
  title text not null,
  make text not null,
  model text not null,
  year int not null,
  price bigint not null,
  mileage int not null default 0,
  fuel text not null default '',
  transmission text not null default '',
  power int not null default 0,
  location text not null default '',
  description text not null default '',
  video_poster text not null,
  video_duration text not null default '1:45',
  features jsonb not null default '[]'::jsonb,
  specs jsonb not null default '[]'::jsonb,
  seller_name text not null,
  seller_type text not null check (seller_type in ('private', 'dealer')),
  seller_status text not null default 'offline'
    check (seller_status in ('online', 'busy', 'offline')),
  seller_rating numeric(2,1) not null default 5.0,
  seller_response_time text not null default '< 5 perc',
  unique_views int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists listings_owner_id_idx on public.listings (owner_id);
create index if not exists listings_created_at_idx on public.listings (created_at desc);
create index if not exists listings_make_model_idx on public.listings (make, model);

-- Unique views
create table if not exists public.listing_views (
  listing_id text not null references public.listings (id) on delete cascade,
  visitor_id text not null,
  created_at timestamptz not null default now(),
  primary key (listing_id, visitor_id)
);

-- updated_at helper
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, email, account_type, company_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1), 'Felhasználó'),
    new.email,
    coalesce(new.raw_user_meta_data->>'account_type', 'personal'),
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

-- Record unique view (idempotent) + increment counter
create or replace function public.record_unique_view(p_listing_id text, p_visitor_id text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  insert into public.listing_views (listing_id, visitor_id)
  values (p_listing_id, p_visitor_id)
  on conflict (listing_id, visitor_id) do nothing;

  if found then
    update public.listings
    set unique_views = unique_views + 1
    where id = p_listing_id
    returning unique_views into v_count;
  else
    select unique_views into v_count from public.listings where id = p_listing_id;
  end if;

  return coalesce(v_count, 0);
end;
$$;

grant execute on function public.record_unique_view(text, text) to anon, authenticated;

-- RLS
alter table public.profiles enable row level security;
alter table public.listings enable row level security;
alter table public.listing_views enable row level security;

-- Profiles policies
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

-- Listings policies
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

-- Listing views policies
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

-- Seed demo listings (idempotent)
insert into public.listings (
  id, owner_id, is_demo, title, make, model, year, price, mileage, fuel, transmission, power,
  location, description, video_poster, video_duration, features, specs,
  seller_name, seller_type, seller_status, seller_rating, seller_response_time, unique_views
) values
(
  '23151001', null, true,
  'BMW 320d xDrive M Sport', 'BMW', '320d', 2021, 12490000, 68400, 'Dízel', 'Automata', 190,
  'Budapest',
  'Teljes szerviztörténettel, M Sport csomaggal. A videóban végigvezetjük a beltért, a futóművet és a menetdinamikát — élő hívásban bármit megmutatunk.',
  'https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&w=1200&q=80',
  '2:14',
  '["M Sport","xDrive","Navigáció","LED","Bőrülések","Vonóhorog"]'::jsonb,
  '[{"label":"Évjárat","value":"2021"},{"label":"Kilométeróra","value":"68 400 km"},{"label":"Üzemanyag","value":"Dízel"},{"label":"Váltó","value":"Automata"},{"label":"Teljesítmény","value":"190 LE"},{"label":"Hajtás","value":"Összkerék"},{"label":"Szín","value":"Portimao Blue"},{"label":"Ajtók","value":"4"}]'::jsonb,
  'AutoVista Kft.', 'dealer', 'online', 4.9, '< 2 perc', 0
),
(
  '23151002', null, true,
  'Tesla Model 3 Long Range', 'Tesla', 'Model 3', 2023, 16890000, 24100, 'Elektromos', 'Automata', 366,
  'Debrecen',
  'Egy tulajdonos, garanciális. A videós túrán látszik a hatótáv-kijelző, a csomagtér és az Autopilot funkciók élőben.',
  'https://images.unsplash.com/photo-1560958089-b8a1929cea89?auto=format&fit=crop&w=1200&q=80',
  '1:48',
  '["Autopilot","Premium hang","Üvegtető","Hőtároló","Sentry Mode"]'::jsonb,
  '[{"label":"Évjárat","value":"2023"},{"label":"Kilométeróra","value":"24 100 km"},{"label":"Üzemanyag","value":"Elektromos"},{"label":"Váltó","value":"Automata"},{"label":"Teljesítmény","value":"366 LE"},{"label":"Hatótáv","value":"602 km"},{"label":"Szín","value":"Midnight Silver"},{"label":"Ajtók","value":"4"}]'::jsonb,
  'Kovács Péter', 'private', 'online', 5.0, '< 5 perc', 0
),
(
  '23151003', null, true,
  'Audi A4 40 TDI S line', 'Audi', 'A4', 2020, 9750000, 92300, 'Dízel', 'Automata', 204,
  'Győr',
  'S line extrákkal, friss gumikkal. Videón bemutatjuk a motorhangot, a beltér állapotát és a futóművet is.',
  'https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?auto=format&fit=crop&w=1200&q=80',
  '2:01',
  '["S line","Virtual Cockpit","Mátrix LED","Bang & Olufsen"]'::jsonb,
  '[{"label":"Évjárat","value":"2020"},{"label":"Kilométeróra","value":"92 300 km"},{"label":"Üzemanyag","value":"Dízel"},{"label":"Váltó","value":"Automata"},{"label":"Teljesítmény","value":"204 LE"},{"label":"Hajtás","value":"Quattro"},{"label":"Szín","value":"Gotland Green"},{"label":"Ajtók","value":"4"}]'::jsonb,
  'Premium Autóház', 'dealer', 'busy', 4.7, '~ 10 perc', 0
),
(
  '23151004', null, true,
  'Volkswagen Golf 1.5 TSI', 'Volkswagen', 'Golf', 2019, 6290000, 78900, 'Benzin', 'Manuális', 150,
  'Szeged',
  'Megbízható, takarékos mindennapi autó. A rövid videóban végignézheted a karosszériát és a beltért sérülésmentesen.',
  'https://images.unsplash.com/photo-1617814076367-b759c7d7e738?auto=format&fit=crop&w=1200&q=80',
  '1:32',
  '["App-Connect","Tempomat","ParkRadar","Klímaautomatika"]'::jsonb,
  '[{"label":"Évjárat","value":"2019"},{"label":"Kilométeróra","value":"78 900 km"},{"label":"Üzemanyag","value":"Benzin"},{"label":"Váltó","value":"Manuális"},{"label":"Teljesítmény","value":"150 LE"},{"label":"Hajtás","value":"Elsőkerék"},{"label":"Szín","value":"Urano Grey"},{"label":"Ajtók","value":"5"}]'::jsonb,
  'Nagy Anna', 'private', 'offline', 4.8, '1 óra', 0
),
(
  '23151005', null, true,
  'Mercedes-Benz C 200 AMG Line', 'Mercedes-Benz', 'C 200', 2022, 15200000, 31500, 'Benzin', 'Automata', 204,
  'Pécs',
  'AMG Line megjelenés, MBUX rendszer. Élő videóhívásban körbejárjuk az autót, és megválaszoljuk a kérdéseidet azonnal.',
  'https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?auto=format&fit=crop&w=1200&q=80',
  '2:28',
  '["AMG Line","MBUX","Kamera 360°","Fűtött ülések","Keyless"]'::jsonb,
  '[{"label":"Évjárat","value":"2022"},{"label":"Kilométeróra","value":"31 500 km"},{"label":"Üzemanyag","value":"Benzin"},{"label":"Váltó","value":"Automata"},{"label":"Teljesítmény","value":"204 LE"},{"label":"Hajtás","value":"Hátsókerék"},{"label":"Szín","value":"Obsidian Black"},{"label":"Ajtók","value":"4"}]'::jsonb,
  'StarMotors Zrt.', 'dealer', 'online', 4.8, '< 1 perc', 0
),
(
  '23151006', null, true,
  'Toyota RAV4 Hybrid AWD', 'Toyota', 'RAV4', 2021, 11350000, 54200, 'Hibrid', 'Automata', 218,
  'Miskolc',
  'Családi SUV alacsony fogyasztással. A videóban látszik a csomagtér, a hátsó ülések és az AWD működés közben.',
  'https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?auto=format&fit=crop&w=1200&q=80',
  '1:56',
  '["AWD","Safety Sense","Panorámatető","Vonóhorog"]'::jsonb,
  '[{"label":"Évjárat","value":"2021"},{"label":"Kilométeróra","value":"54 200 km"},{"label":"Üzemanyag","value":"Hibrid"},{"label":"Váltó","value":"Automata"},{"label":"Teljesítmény","value":"218 LE"},{"label":"Hajtás","value":"Összkerék"},{"label":"Szín","value":"White Pearl"},{"label":"Ajtók","value":"5"}]'::jsonb,
  'Family Cars', 'dealer', 'online', 4.6, '< 3 perc', 0
)
on conflict (id) do nothing;
