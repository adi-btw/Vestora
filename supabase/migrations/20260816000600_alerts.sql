-- ---------------------------------------------------------------------------
-- Price and news alerts.
--
-- Evaluated by the `scan-alerts` function on a schedule rather than in the app,
-- so a triggered alert reaches the user whether or not the app is open.
-- ---------------------------------------------------------------------------

create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  symbol text not null,
  kind text not null,
  -- Price target for price_above/price_below, percentage for percent_move.
  threshold numeric(14, 4),
  keyword text,
  is_active boolean not null default true,
  -- Prevents one choppy stock from sending the same alert every scan.
  cooldown_minutes integer not null default 60,
  last_triggered_at timestamptz,
  created_at timestamptz not null default now(),
  constraint alerts_symbol_format check (symbol ~ '^[A-Z0-9.\-]{1,12}$'),
  constraint alerts_kind_valid
    check (kind in ('price_above', 'price_below', 'percent_move', 'news_keyword')),
  constraint alerts_cooldown_range check (cooldown_minutes between 5 and 1440),
  -- Every kind needs exactly the parameter it is evaluated against.
  constraint alerts_threshold_present check (
    (kind = 'news_keyword' and keyword is not null and length(btrim(keyword)) > 0)
    or (kind <> 'news_keyword' and threshold is not null and threshold > 0)
  )
);

create index if not exists alerts_active_symbol_idx
  on public.alerts (symbol)
  where is_active;

create index if not exists alerts_user_created_idx
  on public.alerts (user_id, created_at desc);

create table if not exists public.alert_events (
  id uuid primary key default gen_random_uuid(),
  alert_id uuid not null references public.alerts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  symbol text not null,
  message text not null,
  triggered_price numeric(14, 4),
  delivered boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists alert_events_user_created_idx
  on public.alert_events (user_id, created_at desc);

alter table public.alerts enable row level security;
alter table public.alert_events enable row level security;

create policy "users manage their own alerts"
  on public.alerts for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Events are written by the scanner (service role) and only read by their owner.
create policy "users read their own alert events"
  on public.alert_events for select
  to authenticated
  using (auth.uid() = user_id);

create policy "users delete their own alert events"
  on public.alert_events for delete
  to authenticated
  using (auth.uid() = user_id);
