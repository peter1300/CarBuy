-- Listing deletion statistics
-- Tracks why listings were deleted: sold on CarBuy, sold elsewhere, or not sold

create table if not exists public.listing_deletions (
  id uuid primary key default gen_random_uuid(),
  listing_id text not null,
  owner_id uuid references public.profiles (id) on delete set null,
  reason text not null check (reason in ('sold_carbuy', 'sold_elsewhere', 'not_sold')),
  listing_title text,
  listing_make text,
  listing_model text,
  listing_price bigint,
  created_at timestamptz not null default now()
);

create index if not exists listing_deletions_reason_idx on public.listing_deletions (reason);
create index if not exists listing_deletions_created_at_idx on public.listing_deletions (created_at desc);

-- RLS
alter table public.listing_deletions enable row level security;

-- Only authenticated users can insert their own deletion records
drop policy if exists "Users can insert own deletion records" on public.listing_deletions;
create policy "Users can insert own deletion records"
  on public.listing_deletions for insert
  with check (auth.uid() = owner_id);

-- Only admins can read deletion stats (we'll handle this in the app layer)
drop policy if exists "Anyone can read deletion stats" on public.listing_deletions;
create policy "Anyone can read deletion stats"
  on public.listing_deletions for select
  using (true);

-- Aggregated stats function for admin dashboard
create or replace function public.get_deletion_stats()
returns table (
  total_deletions bigint,
  sold_carbuy bigint,
  sold_elsewhere bigint,
  not_sold bigint,
  carbuy_conversion_rate numeric
)
language sql
security definer
set search_path = public
as $$
  select
    count(*)::bigint as total_deletions,
    count(*) filter (where reason = 'sold_carbuy')::bigint as sold_carbuy,
    count(*) filter (where reason = 'sold_elsewhere')::bigint as sold_elsewhere,
    count(*) filter (where reason = 'not_sold')::bigint as not_sold,
    case
      when count(*) filter (where reason in ('sold_carbuy', 'sold_elsewhere')) > 0
      then round(
        count(*) filter (where reason = 'sold_carbuy')::numeric /
        count(*) filter (where reason in ('sold_carbuy', 'sold_elsewhere'))::numeric * 100,
        1
      )
      else 0
    end as carbuy_conversion_rate
  from public.listing_deletions;
$$;

grant execute on function public.get_deletion_stats() to anon, authenticated;
