-- Listing video uploads (run after previous migrations)

alter table public.listings
  add column if not exists video_url text;

-- Public bucket so listing videos are viewable without login
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'listing-videos',
  'listing-videos',
  true,
  104857600,
  array['video/mp4', 'video/webm', 'video/quicktime', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users upload own listing videos" on storage.objects;
create policy "Users upload own listing videos"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'listing-videos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Public read listing videos" on storage.objects;
create policy "Public read listing videos"
  on storage.objects for select
  using (bucket_id = 'listing-videos');

drop policy if exists "Users delete own listing videos" on storage.objects;
create policy "Users delete own listing videos"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'listing-videos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
