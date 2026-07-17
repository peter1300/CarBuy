-- Unread tracking for messaging badge
-- Run after 003_messaging.sql

alter table public.conversations
  add column if not exists buyer_last_read_at timestamptz not null default now();

alter table public.conversations
  add column if not exists seller_last_read_at timestamptz not null default now();

grant update on table public.conversations to authenticated;

drop policy if exists "Participants can update conversations" on public.conversations;
create policy "Participants can update conversations"
  on public.conversations for update
  using (auth.uid() = buyer_id or auth.uid() = seller_id)
  with check (auth.uid() = buyer_id or auth.uid() = seller_id);
