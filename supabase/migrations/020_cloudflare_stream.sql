-- Cloudflare Stream: store media UIDs on listings

alter table public.listings
  add column if not exists stream_uid text,
  add column if not exists flaws_stream_uid text;

create index if not exists listings_stream_uid_idx
  on public.listings (stream_uid)
  where stream_uid is not null;

comment on column public.listings.stream_uid is
  'Cloudflare Stream media uid for the main listing video.';
comment on column public.listings.flaws_stream_uid is
  'Cloudflare Stream media uid for the optional flaws video.';
