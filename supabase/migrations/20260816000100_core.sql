-- ---------------------------------------------------------------------------
-- Core identity and watchlist tables.
--
-- Every user-owned table carries `user_id` and is protected by RLS so a leaked
-- anon key still cannot read another account's rows. Shared market-data caches
-- (added in a later migration) deliberately have no policies at all: only the
-- service role used by Edge Functions may touch them.
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Profiles -------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles are self-readable"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles are self-writable"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Watchlists -----------------------------------------------------------------

create table if not exists public.watchlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null default 'My watchlist',
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint watchlists_name_not_blank check (length(btrim(name)) > 0)
);

create index if not exists watchlists_user_id_idx on public.watchlists (user_id);

-- At most one default list per user, which lets the app open without a picker.
create unique index if not exists watchlists_one_default_per_user
  on public.watchlists (user_id)
  where is_default;

alter table public.watchlists enable row level security;

create policy "watchlists are owner-managed"
  on public.watchlists for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create trigger watchlists_set_updated_at
  before update on public.watchlists
  for each row execute function public.set_updated_at();

-- Watchlist items ------------------------------------------------------------

create table if not exists public.watchlist_items (
  id uuid primary key default gen_random_uuid(),
  watchlist_id uuid not null references public.watchlists (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  symbol text not null,
  notes text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint watchlist_items_symbol_format check (symbol ~ '^[A-Z0-9.\-]{1,12}$'),
  constraint watchlist_items_unique_symbol unique (watchlist_id, symbol)
);

create index if not exists watchlist_items_user_id_idx on public.watchlist_items (user_id);
create index if not exists watchlist_items_watchlist_idx
  on public.watchlist_items (watchlist_id, sort_order);

alter table public.watchlist_items enable row level security;

-- `user_id` is denormalised so the common-case policy is an index lookup rather
-- than a join, but inserts still have to prove ownership of the parent list.
create policy "watchlist items are owner-readable"
  on public.watchlist_items for select
  using (auth.uid() = user_id);

create policy "watchlist items are owner-insertable"
  on public.watchlist_items for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.watchlists w
      where w.id = watchlist_id and w.user_id = auth.uid()
    )
  );

create policy "watchlist items are owner-updatable"
  on public.watchlist_items for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "watchlist items are owner-deletable"
  on public.watchlist_items for delete
  using (auth.uid() = user_id);

-- Symbol directory -----------------------------------------------------------
-- Populated by the market-data function as symbols are searched, so repeated
-- lookups never leave the database.

create table if not exists public.symbols (
  symbol text primary key,
  name text,
  exchange text,
  security_type text,
  currency text,
  updated_at timestamptz not null default now()
);

alter table public.symbols enable row level security;

create policy "symbol directory is readable by signed-in users"
  on public.symbols for select
  to authenticated
  using (true);

-- Push tokens ----------------------------------------------------------------

create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  token text not null,
  platform text not null default 'unknown',
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  constraint push_tokens_unique_token unique (token)
);

create index if not exists push_tokens_user_id_idx on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;

create policy "push tokens are owner-managed"
  on public.push_tokens for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- New user bootstrap ---------------------------------------------------------
-- Gives every account a profile and a default watchlist on first sign-up so no
-- screen has to handle a "nothing exists yet" state.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, split_part(coalesce(new.email, ''), '@', 1))
  on conflict (id) do nothing;

  insert into public.watchlists (user_id, name, is_default)
  values (new.id, 'My watchlist', true);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
