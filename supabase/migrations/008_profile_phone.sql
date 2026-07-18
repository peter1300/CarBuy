-- Seller phone on profiles (for product page contact, shown only to logged-in users in UI)

alter table public.profiles
  add column if not exists phone text;
