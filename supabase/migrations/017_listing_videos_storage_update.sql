-- Allow owners to replace listing video files (needed for upsert during processing)

drop policy if exists "Users update own listing videos" on storage.objects;
create policy "Users update own listing videos"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'listing-videos'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'listing-videos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
