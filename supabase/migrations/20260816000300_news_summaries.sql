-- ---------------------------------------------------------------------------
-- AI news summaries.
--
-- Keyed by (symbol, day) rather than by article: one Gemini call covers a whole
-- day of headlines for a symbol, which is what keeps the feature inside a
-- 1,500 request/day free tier no matter how many users share a ticker.
-- ---------------------------------------------------------------------------

create table if not exists public.news_summaries (
  symbol text not null,
  summary_date date not null,
  sentiment text not null,
  summary text not null,
  key_drivers jsonb not null default '[]'::jsonb,
  article_count integer not null default 0,
  model text not null,
  generated_at timestamptz not null default now(),
  primary key (symbol, summary_date),
  constraint news_summaries_sentiment_valid
    check (sentiment in ('bullish', 'bearish', 'neutral', 'mixed'))
);

create index if not exists news_summaries_generated_at_idx
  on public.news_summaries (generated_at desc);

alter table public.news_summaries enable row level security;

-- Summaries are derived from public news and are identical for every user, so
-- they are readable by any signed-in account. Writes stay with the service role.
create policy "news summaries are readable by signed-in users"
  on public.news_summaries for select
  to authenticated
  using (true);
