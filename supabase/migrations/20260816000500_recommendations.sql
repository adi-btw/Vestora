-- ---------------------------------------------------------------------------
-- Stored recommendations.
--
-- Generating a set costs several provider calls plus one model call, so results
-- are persisted per user and reused until explicitly refreshed. `signals` keeps
-- the deterministic inputs behind each score, which is what makes the ranking
-- auditable rather than a black box.
-- ---------------------------------------------------------------------------

create table if not exists public.recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  symbol text not null,
  score numeric(5, 2) not null,
  thesis text not null,
  risks text not null,
  confidence numeric(3, 2) not null default 0.5,
  signals jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default now(),
  dismissed_at timestamptz,
  constraint recommendations_symbol_format check (symbol ~ '^[A-Z0-9.\-]{1,12}$'),
  constraint recommendations_score_range check (score >= 0 and score <= 100),
  constraint recommendations_confidence_range check (confidence >= 0 and confidence <= 1),
  constraint recommendations_unique_symbol unique (user_id, symbol)
);

create index if not exists recommendations_user_score_idx
  on public.recommendations (user_id, score desc);

alter table public.recommendations enable row level security;

create policy "users manage their own recommendations"
  on public.recommendations for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
