-- Flaws / honesty video on listings (run after 005_listing_videos.sql)

alter table public.listings
  add column if not exists flaws_video_url text;
