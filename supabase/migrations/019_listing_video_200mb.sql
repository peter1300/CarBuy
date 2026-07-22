-- Raise listing video upload limit to 200 MB

update storage.buckets
set file_size_limit = 209715200
where id = 'listing-videos';
