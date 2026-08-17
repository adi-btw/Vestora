-- ---------------------------------------------------------------------------
-- AI advisor chat: threads and messages.
--
-- The transcript lives server-side so a conversation survives reinstalls and so
-- the tool-calling loop can rebuild context without trusting client-supplied
-- history.
-- ---------------------------------------------------------------------------

create table if not exists public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default 'New chat',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists chat_threads_user_updated_idx
  on public.chat_threads (user_id, updated_at desc);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.chat_threads (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null,
  content text not null default '',
  -- Tool calls and their results, kept so the transcript can be replayed and so
  -- the UI can show which data the answer was grounded in.
  tool_calls jsonb,
  created_at timestamptz not null default now(),
  constraint chat_messages_role_valid check (role in ('user', 'assistant', 'tool', 'system'))
);

create index if not exists chat_messages_thread_created_idx
  on public.chat_messages (thread_id, created_at);

alter table public.chat_threads enable row level security;
alter table public.chat_messages enable row level security;

create policy "users manage their own threads"
  on public.chat_threads for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "users read their own messages"
  on public.chat_messages for select
  to authenticated
  using (auth.uid() = user_id);

-- Inserts go through the Edge Function, but allowing them here too keeps an
-- optimistic client write possible without a second round-trip.
create policy "users add messages to their own threads"
  on public.chat_messages for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.chat_threads t
      where t.id = thread_id and t.user_id = auth.uid()
    )
  );

create policy "users delete their own messages"
  on public.chat_messages for delete
  to authenticated
  using (auth.uid() = user_id);

create trigger chat_threads_set_updated_at
  before update on public.chat_threads
  for each row execute function public.set_updated_at();

-- Bumping the parent thread on every message keeps the thread list ordered by
-- real activity without a subquery on read.
create or replace function public.touch_chat_thread()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.chat_threads
  set updated_at = now()
  where id = new.thread_id;
  return new;
end;
$$;

create trigger chat_messages_touch_thread
  after insert on public.chat_messages
  for each row execute function public.touch_chat_thread();
