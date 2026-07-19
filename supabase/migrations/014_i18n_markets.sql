-- i18n markets: listing country + user locale / browse country preferences

alter table public.listings
  add column if not exists country text not null default 'HU';

alter table public.listings
  drop constraint if exists listings_country_check;

alter table public.listings
  add constraint listings_country_check
  check (country in ('HU', 'DE', 'AT', 'ES', 'US', 'MX'));

create index if not exists listings_country_created_at_idx
  on public.listings (country, created_at desc);

alter table public.profiles
  add column if not exists ui_locale text;

alter table public.profiles
  add column if not exists browse_country text;

alter table public.profiles
  drop constraint if exists profiles_ui_locale_check;

alter table public.profiles
  add constraint profiles_ui_locale_check
  check (ui_locale is null or ui_locale in ('hu', 'en', 'es', 'de'));

alter table public.profiles
  drop constraint if exists profiles_browse_country_check;

alter table public.profiles
  add constraint profiles_browse_country_check
  check (browse_country is null or browse_country in ('HU', 'DE', 'AT', 'ES', 'US', 'MX'));

update public.listings set country = 'HU' where country is null or country = '';
