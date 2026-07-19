-- Admin panel: is_admin helper, update policies, daily activity stats
-- After running: set your admin email (must match VITE_ADMIN_EMAIL):
--   update public.app_settings set value = 'you@example.com' where key = 'admin_email';

create table if not exists public.app_settings (
  key text primary key,
  value text not null
);

insert into public.app_settings (key, value)
values ('admin_email', 'admin@example.com')
on conflict (key) do nothing;

alter table public.app_settings enable row level security;

drop policy if exists "App settings readable by authenticated" on public.app_settings;
create policy "App settings readable by authenticated"
  on public.app_settings for select
  to authenticated
  using (true);

grant select on table public.app_settings to authenticated;
grant all on table public.app_settings to service_role;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    lower(coalesce(auth.jwt() ->> 'email', '')) =
      (select lower(value) from public.app_settings where key = 'admin_email' limit 1),
    false
  );
$$;

grant execute on function public.is_admin() to anon, authenticated;

drop policy if exists "Admins can update any profile" on public.profiles;
create policy "Admins can update any profile"
  on public.profiles for update
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins can update any listing" on public.listings;
create policy "Admins can update any listing"
  on public.listings for update
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins can delete any listing" on public.listings;
create policy "Admins can delete any listing"
  on public.listings for delete
  using (public.is_admin());

create or replace function public.get_daily_activity_stats(p_days integer default 30)
returns table (
  day date,
  registrations bigint,
  listings_created bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Nincs admin jogosultság';
  end if;

  if p_days is null or p_days < 1 then
    p_days := 30;
  end if;
  if p_days > 90 then
    p_days := 90;
  end if;

  return query
  with days as (
    select generate_series(
      (current_date - (p_days - 1)),
      current_date,
      interval '1 day'
    )::date as day
  ),
  reg as (
    select (created_at at time zone 'Europe/Budapest')::date as day, count(*)::bigint as cnt
    from public.profiles
    where created_at >= (current_date - (p_days - 1))::timestamptz
    group by 1
  ),
  lis as (
    select (created_at at time zone 'Europe/Budapest')::date as day, count(*)::bigint as cnt
    from public.listings
    where created_at >= (current_date - (p_days - 1))::timestamptz
      and coalesce(is_demo, false) = false
    group by 1
  )
  select
    d.day,
    coalesce(r.cnt, 0)::bigint as registrations,
    coalesce(l.cnt, 0)::bigint as listings_created
  from days d
  left join reg r on r.day = d.day
  left join lis l on l.day = d.day
  order by d.day;
end;
$$;

grant execute on function public.get_daily_activity_stats(integer) to authenticated;
