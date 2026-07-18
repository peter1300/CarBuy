-- Higher quality mobile video uploads: larger limit + more MIME types

update storage.buckets
set
  file_size_limit = 157286400,
  allowed_mime_types = array[
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'video/3gpp',
    'video/3gpp2',
    'video/x-m4v',
    'image/jpeg',
    'image/webp'
  ]
where id = 'listing-videos';
