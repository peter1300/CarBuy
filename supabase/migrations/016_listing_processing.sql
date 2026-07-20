-- Background video processing status for listings

alter table public.listings
  add column if not exists processing_status text not null default 'ready'
    check (processing_status in ('processing', 'ready', 'failed'));

create index if not exists listings_processing_status_idx
  on public.listings (processing_status)
  where processing_status <> 'ready';

update public.listings
set processing_status = 'ready'
where processing_status is null;
