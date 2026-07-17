-- Messaging: conversations, messages, storage, RLS
-- Run in Supabase SQL Editor after 001/002

-- Conversations (one thread per listing + buyer)
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  listing_id text not null references public.listings (id) on delete cascade,
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  seller_id uuid not null references public.profiles (id) on delete cascade,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint conversations_buyer_seller_distinct check (buyer_id <> seller_id),
  constraint conversations_listing_buyer_unique unique (listing_id, buyer_id)
);

create index if not exists conversations_buyer_id_idx on public.conversations (buyer_id);
create index if not exists conversations_seller_id_idx on public.conversations (seller_id);
create index if not exists conversations_last_message_at_idx on public.conversations (last_message_at desc);

-- Messages
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text,
  video_path text,
  created_at timestamptz not null default now(),
  constraint messages_has_content check (
    (body is not null and length(trim(body)) > 0) or video_path is not null
  )
);

create index if not exists messages_conversation_id_created_at_idx
  on public.messages (conversation_id, created_at asc);

-- Bump conversation last_message_at
create or replace function public.touch_conversation_on_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations
  set last_message_at = new.created_at
  where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists messages_touch_conversation on public.messages;
create trigger messages_touch_conversation
  after insert on public.messages
  for each row execute function public.touch_conversation_on_message();

-- Grants
grant select, insert on table public.conversations to authenticated;
grant select, insert on table public.messages to authenticated;
grant all on table public.conversations to service_role;
grant all on table public.messages to service_role;

-- RLS
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

drop policy if exists "Participants can read conversations" on public.conversations;
create policy "Participants can read conversations"
  on public.conversations for select
  using (auth.uid() = buyer_id or auth.uid() = seller_id);

drop policy if exists "Buyers can create conversations" on public.conversations;
create policy "Buyers can create conversations"
  on public.conversations for insert
  with check (
    auth.uid() = buyer_id
    and buyer_id <> seller_id
    and exists (
      select 1 from public.listings l
      where l.id = listing_id
        and l.owner_id = seller_id
        and l.is_demo = false
    )
  );

drop policy if exists "Participants can read messages" on public.messages;
create policy "Participants can read messages"
  on public.messages for select
  using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())
    )
  );

drop policy if exists "Participants can send messages" on public.messages;
create policy "Participants can send messages"
  on public.messages for insert
  with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())
    )
  );

-- Realtime
do $$
begin
  alter publication supabase_realtime add table public.messages;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

-- Storage bucket for message videos
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'message-videos',
  'message-videos',
  false,
  41943040,
  array['video/mp4', 'video/webm', 'video/quicktime']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users upload own message videos" on storage.objects;
create policy "Users upload own message videos"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'message-videos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Authenticated can read message videos" on storage.objects;
create policy "Authenticated can read message videos"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'message-videos');

drop policy if exists "Users delete own message videos" on storage.objects;
create policy "Users delete own message videos"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'message-videos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
