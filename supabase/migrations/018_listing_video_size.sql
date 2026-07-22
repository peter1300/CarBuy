-- Store compressed main video size (bytes) for admin monitoring

alter table public.listings
  add column if not exists video_size_bytes bigint;

comment on column public.listings.video_size_bytes is
  'Main listing video file size in bytes after client-side compression and before/at upload.';
