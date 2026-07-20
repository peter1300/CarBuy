-- Inbox preview columns + unread count RPC (avoid loading all messages)
-- Run after 004_message_reads.sql

alter table public.conversations
  add column if not exists last_message_body text,
  add column if not exists last_message_video_path text,
  add column if not exists last_message_sender_id uuid references public.profiles (id);

create or replace function public.touch_conversation_on_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations
  set
    last_message_at = new.created_at,
    last_message_body = new.body,
    last_message_video_path = new.video_path,
    last_message_sender_id = new.sender_id
  where id = new.conversation_id;
  return new;
end;
$$;

-- Backfill preview fields from latest message per conversation
update public.conversations c
set
  last_message_body = m.body,
  last_message_video_path = m.video_path,
  last_message_sender_id = m.sender_id,
  last_message_at = m.created_at
from (
  select distinct on (conversation_id)
    conversation_id,
    body,
    video_path,
    sender_id,
    created_at
  from public.messages
  order by conversation_id, created_at desc
) m
where c.id = m.conversation_id;

create or replace function public.get_unread_message_counts(p_user_id uuid)
returns table (conversation_id uuid, unread_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    m.conversation_id,
    count(*)::bigint as unread_count
  from public.messages m
  inner join public.conversations c on c.id = m.conversation_id
  where (c.buyer_id = p_user_id or c.seller_id = p_user_id)
    and m.sender_id <> p_user_id
    and m.created_at > case
      when c.buyer_id = p_user_id then c.buyer_last_read_at
      else c.seller_last_read_at
    end
  group by m.conversation_id;
$$;

grant execute on function public.get_unread_message_counts(uuid) to authenticated;
