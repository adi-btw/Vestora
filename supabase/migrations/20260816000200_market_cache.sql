-- ---------------------------------------------------------------------------
-- Shared market-data caches and the per-user rate limiter.
--
-- These tables are written only by Edge Functions running with the service role.
-- RLS is enabled with no policies on purpose: the anon/authenticated roles have
-- no path to them at all, which keeps provider payloads and quota counters out
-- of reach of the client.
--
-- The cache is what makes a 60 request/minute free tier viable: N users watching
-- AAPL cost one upstream call, not N.
-- ---------------------------------------------------------------------------

create table if not exists public.quote_cache (
  symbol text primary key,
  price numeric,
  change numeric,
  change_percent numeric,
  day_high numeric,
  day_low numeric,
  day_open numeric,
  previous_close numeric,
  provider text not null,
  fetched_at timestamptz not null default now()
);

create index if not exists quote_cache_fetched_at_idx on public.quote_cache (fetched_at);

alter table public.quote_cache enable row level security;

-- Bars are stored as a JSON array per (symbol, timeframe). A row-per-bar layout
-- would be more normalised but 500 MB of free storage goes fast, and the app
-- always reads a whole series at once.
create table if not exists public.bar_cache (
  symbol text not null,
  timeframe text not null,
  bars jsonb not null,
  provider text not null,
  fetched_at timestamptz not null default now(),
  primary key (symbol, timeframe)
);

alter table public.bar_cache enable row level security;

create table if not exists public.news_cache (
  id bigint generated always as identity primary key,
  symbol text not null,
  external_id text not null,
  headline text not null,
  summary text,
  source text,
  url text not null,
  image_url text,
  published_at timestamptz not null,
  fetched_at timestamptz not null default now(),
  constraint news_cache_unique_article unique (symbol, external_id)
);

create index if not exists news_cache_symbol_published_idx
  on public.news_cache (symbol, published_at desc);

alter table public.news_cache enable row level security;

-- Company fundamentals and peer lists change slowly; a day-long TTL is plenty.
create table if not exists public.company_cache (
  symbol text primary key,
  profile jsonb,
  financials jsonb,
  peers jsonb,
  recommendation_trend jsonb,
  fetched_at timestamptz not null default now()
);

alter table public.company_cache enable row level security;

-- Rate limiting ---------------------------------------------------------------
-- A fixed-window counter per (user, bucket). Fixed windows can allow a burst at
-- a boundary, which is an acceptable trade for a single atomic upsert.

create table if not exists public.rate_limits (
  user_id uuid not null references auth.users (id) on delete cascade,
  bucket text not null,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0,
  primary key (user_id, bucket)
);

alter table public.rate_limits enable row level security;

create or replace function public.consume_rate_limit(
  p_user_id uuid,
  p_bucket text,
  p_limit integer,
  p_window_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_window_start timestamptz;
  v_count integer;
begin
  insert into public.rate_limits (user_id, bucket, window_started_at, request_count)
  values (p_user_id, p_bucket, v_now, 1)
  on conflict (user_id, bucket) do update
    set
      window_started_at = case
        when public.rate_limits.window_started_at < v_now - make_interval(secs => p_window_seconds)
          then v_now
        else public.rate_limits.window_started_at
      end,
      request_count = case
        when public.rate_limits.window_started_at < v_now - make_interval(secs => p_window_seconds)
          then 1
        else public.rate_limits.request_count + 1
      end
  returning window_started_at, request_count into v_window_start, v_count;

  return jsonb_build_object(
    'allowed', v_count <= p_limit,
    'count', v_count,
    'limit', p_limit,
    'retry_after_seconds',
    greatest(0, p_window_seconds - floor(extract(epoch from (v_now - v_window_start)))::integer)
  );
end;
$$;

revoke all on function public.consume_rate_limit(uuid, text, integer, integer) from public, anon, authenticated;
