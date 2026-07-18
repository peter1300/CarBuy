-- Reels feed: watch-time stats for listing main videos

create table if not exists public.reel_stats (
  listing_id text primary key references public.listings (id) on delete cascade,
  impressions integer not null default 0,
  total_watch_ms bigint not null default 0,
  completions integer not null default 0,
  avg_watch_ratio numeric(6,4) not null default 0,
  updated_at timestamptz not null default now()
);

create index if not exists reel_stats_avg_watch_ratio_idx
  on public.reel_stats (avg_watch_ratio desc);

alter table public.reel_stats enable row level security;

drop policy if exists "Reel stats are publicly readable" on public.reel_stats;
create policy "Reel stats are publicly readable"
  on public.reel_stats for select
  using (true);

grant select on table public.reel_stats to anon, authenticated;
grant all on table public.reel_stats to service_role;

-- Idempotent-ish watch report: increments counters and updates running avg ratio
create or replace function public.record_reel_watch(
  p_listing_id text,
  p_watch_ms integer,
  p_duration_ms integer,
  p_completed boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_watch integer := greatest(coalesce(p_watch_ms, 0), 0);
  v_duration integer := greatest(coalesce(p_duration_ms, 0), 1);
  v_ratio numeric := least(1.0, v_watch::numeric / v_duration::numeric);
  v_prev_impr integer;
  v_prev_avg numeric;
begin
  if p_listing_id is null or length(trim(p_listing_id)) = 0 then
    return;
  end if;

  -- Ignore tiny accidental plays
  if v_watch < 400 then
    return;
  end if;

  insert into public.reel_stats (listing_id, impressions, total_watch_ms, completions, avg_watch_ratio, updated_at)
  values (
    p_listing_id,
    1,
    v_watch,
    case when p_completed or v_ratio >= 0.9 then 1 else 0 end,
    v_ratio,
    now()
  )
  on conflict (listing_id) do update
  set
    impressions = public.reel_stats.impressions + 1,
    total_watch_ms = public.reel_stats.total_watch_ms + v_watch,
    completions = public.reel_stats.completions
      + case when p_completed or v_ratio >= 0.9 then 1 else 0 end,
    avg_watch_ratio = (
      (public.reel_stats.avg_watch_ratio * public.reel_stats.impressions) + v_ratio
    ) / (public.reel_stats.impressions + 1),
    updated_at = now();
end;
$$;

grant execute on function public.record_reel_watch(text, integer, integer, boolean) to anon, authenticated;
