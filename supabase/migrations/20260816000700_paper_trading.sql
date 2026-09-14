-- ---------------------------------------------------------------------------
-- Simulated paper trading.
--
-- All money movement happens inside `place_paper_order` so that the cash debit,
-- the position update and the order record either all land or none do. Doing the
-- same arithmetic in an Edge Function would leave a window where two concurrent
-- orders both pass the cash check.
--
-- Nothing here touches real money or a broker.
-- ---------------------------------------------------------------------------

create table if not exists public.portfolios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  cash numeric(16, 2) not null default 100000,
  starting_cash numeric(16, 2) not null default 100000,
  created_at timestamptz not null default now(),
  constraint portfolios_one_per_user unique (user_id),
  constraint portfolios_cash_not_negative check (cash >= 0)
);

create table if not exists public.positions (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  symbol text not null,
  quantity numeric(16, 4) not null default 0,
  -- Average cost of the shares still held; reset once a position is closed.
  avg_cost numeric(14, 4) not null default 0,
  realized_pnl numeric(16, 2) not null default 0,
  updated_at timestamptz not null default now(),
  constraint positions_unique_symbol unique (portfolio_id, symbol),
  constraint positions_quantity_not_negative check (quantity >= 0),
  constraint positions_symbol_format check (symbol ~ '^[A-Z0-9.\-]{1,12}$')
);

create index if not exists positions_user_idx on public.positions (user_id);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  symbol text not null,
  side text not null,
  order_type text not null,
  quantity numeric(16, 4) not null,
  limit_price numeric(14, 4),
  status text not null default 'pending',
  filled_price numeric(14, 4),
  filled_at timestamptz,
  reject_reason text,
  created_at timestamptz not null default now(),
  constraint orders_side_valid check (side in ('buy', 'sell')),
  constraint orders_type_valid check (order_type in ('market', 'limit')),
  constraint orders_status_valid check (status in ('filled', 'pending', 'rejected', 'canceled')),
  constraint orders_quantity_positive check (quantity > 0),
  constraint orders_limit_price_present check (order_type <> 'limit' or limit_price is not null)
);

create index if not exists orders_user_created_idx on public.orders (user_id, created_at desc);

create index if not exists orders_pending_symbol_idx
  on public.orders (symbol)
  where status = 'pending';

-- One row per portfolio per day, which is all an equity curve needs and keeps the
-- table tiny on a 500 MB free database.
create table if not exists public.portfolio_snapshots (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  captured_on date not null default current_date,
  equity numeric(16, 2) not null,
  cash numeric(16, 2) not null,
  positions_value numeric(16, 2) not null,
  constraint portfolio_snapshots_unique_day unique (portfolio_id, captured_on)
);

create index if not exists portfolio_snapshots_user_day_idx
  on public.portfolio_snapshots (user_id, captured_on);

alter table public.portfolios enable row level security;
alter table public.positions enable row level security;
alter table public.orders enable row level security;
alter table public.portfolio_snapshots enable row level security;

-- Reads are owner-scoped; every write goes through the functions below.
create policy "users read their own portfolio"
  on public.portfolios for select
  to authenticated
  using (auth.uid() = user_id);

create policy "users read their own positions"
  on public.positions for select
  to authenticated
  using (auth.uid() = user_id);

create policy "users read their own orders"
  on public.orders for select
  to authenticated
  using (auth.uid() = user_id);

create policy "users cancel their own pending orders"
  on public.orders for update
  to authenticated
  using (auth.uid() = user_id and status = 'pending')
  with check (auth.uid() = user_id and status in ('pending', 'canceled'));

create policy "users read their own snapshots"
  on public.portfolio_snapshots for select
  to authenticated
  using (auth.uid() = user_id);

-- Portfolio bootstrap ---------------------------------------------------------

create or replace function public.ensure_portfolio()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_portfolio_id uuid;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  insert into public.portfolios (user_id)
  values (v_user_id)
  on conflict (user_id) do nothing;

  select id into v_portfolio_id from public.portfolios where user_id = v_user_id;
  return v_portfolio_id;
end;
$$;

-- Give new accounts a funded portfolio alongside their profile and watchlist.
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

  insert into public.portfolios (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

-- Order placement -------------------------------------------------------------

/**
 * Places one order and applies its effects atomically.
 *
 * The caller supplies the market price (the Edge Function has just fetched it
 * through the cache); this function decides whether the order fills, and rejects
 * rather than raising so the client always gets a row it can display.
 */
create or replace function public.place_paper_order(
  p_symbol text,
  p_side text,
  p_order_type text,
  p_quantity numeric,
  p_limit_price numeric,
  p_market_price numeric
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_symbol text := upper(btrim(p_symbol));
  v_portfolio public.portfolios;
  v_position public.positions;
  v_order public.orders;
  v_fill_price numeric(14, 4);
  v_cost numeric(16, 2);
  v_new_quantity numeric(16, 4);
  v_reject text;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  if p_side not in ('buy', 'sell') then
    raise exception 'invalid_side';
  end if;

  if p_order_type not in ('market', 'limit') then
    raise exception 'invalid_order_type';
  end if;

  if p_quantity is null or p_quantity <= 0 then
    raise exception 'invalid_quantity';
  end if;

  -- Lock the portfolio row for the duration: this is what serialises concurrent
  -- orders against the same cash balance.
  select * into v_portfolio
  from public.portfolios
  where user_id = v_user_id
  for update;

  if not found then
    insert into public.portfolios (user_id) values (v_user_id) returning * into v_portfolio;
  end if;

  select * into v_position
  from public.positions
  where portfolio_id = v_portfolio.id and symbol = v_symbol
  for update;

  -- Decide the fill.
  if p_order_type = 'market' then
    if p_market_price is null or p_market_price <= 0 then
      v_reject := 'No live price available for this symbol.';
    else
      v_fill_price := p_market_price;
    end if;
  else
    if p_market_price is null or p_market_price <= 0 then
      -- Leave it pending; the scheduled sweep will fill it when a price arrives.
      v_fill_price := null;
    elsif p_side = 'buy' and p_market_price <= p_limit_price then
      v_fill_price := p_market_price;
    elsif p_side = 'sell' and p_market_price >= p_limit_price then
      v_fill_price := p_market_price;
    else
      v_fill_price := null;
    end if;
  end if;

  -- Validate against cash and holdings only when it would fill now.
  if v_reject is null and v_fill_price is not null then
    if p_side = 'buy' then
      v_cost := round(p_quantity * v_fill_price, 2);
      if v_cost > v_portfolio.cash then
        v_reject := format(
          'Not enough cash: the order costs $%s and you have $%s.',
          to_char(v_cost, 'FM999999999.00'),
          to_char(v_portfolio.cash, 'FM999999999.00')
        );
      end if;
    else
      if v_position.id is null or v_position.quantity < p_quantity then
        v_reject := format(
          'You hold %s shares of %s.',
          to_char(coalesce(v_position.quantity, 0), 'FM999999999.####'),
          v_symbol
        );
      end if;
    end if;
  end if;

  if v_reject is not null then
    insert into public.orders (
      portfolio_id, user_id, symbol, side, order_type, quantity, limit_price,
      status, reject_reason
    )
    values (
      v_portfolio.id, v_user_id, v_symbol, p_side, p_order_type, p_quantity, p_limit_price,
      'rejected', v_reject
    )
    returning * into v_order;

    return v_order;
  end if;

  if v_fill_price is null then
    insert into public.orders (
      portfolio_id, user_id, symbol, side, order_type, quantity, limit_price, status
    )
    values (
      v_portfolio.id, v_user_id, v_symbol, p_side, p_order_type, p_quantity, p_limit_price,
      'pending'
    )
    returning * into v_order;

    return v_order;
  end if;

  if p_side = 'buy' then
    v_cost := round(p_quantity * v_fill_price, 2);

    update public.portfolios
    set cash = cash - v_cost
    where id = v_portfolio.id;

    if v_position.id is null then
      insert into public.positions (portfolio_id, user_id, symbol, quantity, avg_cost)
      values (v_portfolio.id, v_user_id, v_symbol, p_quantity, v_fill_price);
    else
      v_new_quantity := v_position.quantity + p_quantity;

      update public.positions
      set
        -- Weighted average cost basis, so P&L survives multiple buys.
        avg_cost = round(
          (v_position.quantity * v_position.avg_cost + p_quantity * v_fill_price) / v_new_quantity,
          4
        ),
        quantity = v_new_quantity,
        updated_at = now()
      where id = v_position.id;
    end if;
  else
    v_new_quantity := v_position.quantity - p_quantity;

    update public.portfolios
    set cash = cash + round(p_quantity * v_fill_price, 2)
    where id = v_portfolio.id;

    update public.positions
    set
      quantity = v_new_quantity,
      -- Closing the position clears the basis but keeps realised P&L to date.
      avg_cost = case when v_new_quantity = 0 then 0 else v_position.avg_cost end,
      realized_pnl = realized_pnl + round(p_quantity * (v_fill_price - v_position.avg_cost), 2),
      updated_at = now()
    where id = v_position.id;
  end if;

  insert into public.orders (
    portfolio_id, user_id, symbol, side, order_type, quantity, limit_price,
    status, filled_price, filled_at
  )
  values (
    v_portfolio.id, v_user_id, v_symbol, p_side, p_order_type, p_quantity, p_limit_price,
    'filled', v_fill_price, now()
  )
  returning * into v_order;

  return v_order;
end;
$$;

/**
 * Fills one already-pending limit order at a price the caller has verified.
 *
 * Runs as the service role from the scheduled sweep, so it takes the order id and
 * derives the owner from the row rather than from `auth.uid()`.
 */
create or replace function public.fill_pending_order(
  p_order_id uuid,
  p_market_price numeric
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_portfolio public.portfolios;
  v_position public.positions;
  v_cost numeric(16, 2);
  v_new_quantity numeric(16, 4);
begin
  select * into v_order
  from public.orders
  where id = p_order_id and status = 'pending'
  for update;

  if not found or p_market_price is null or p_market_price <= 0 then
    return false;
  end if;

  if v_order.side = 'buy' and p_market_price > v_order.limit_price then
    return false;
  end if;

  if v_order.side = 'sell' and p_market_price < v_order.limit_price then
    return false;
  end if;

  select * into v_portfolio from public.portfolios where id = v_order.portfolio_id for update;
  select * into v_position
  from public.positions
  where portfolio_id = v_order.portfolio_id and symbol = v_order.symbol
  for update;

  if v_order.side = 'buy' then
    v_cost := round(v_order.quantity * p_market_price, 2);

    -- Cash may have been spent since the order was placed.
    if v_cost > v_portfolio.cash then
      update public.orders
      set status = 'rejected', reject_reason = 'Not enough cash when the limit was reached.'
      where id = v_order.id;
      return false;
    end if;

    update public.portfolios set cash = cash - v_cost where id = v_portfolio.id;

    if v_position.id is null then
      insert into public.positions (portfolio_id, user_id, symbol, quantity, avg_cost)
      values (v_order.portfolio_id, v_order.user_id, v_order.symbol, v_order.quantity, p_market_price);
    else
      v_new_quantity := v_position.quantity + v_order.quantity;

      update public.positions
      set
        avg_cost = round(
          (v_position.quantity * v_position.avg_cost + v_order.quantity * p_market_price)
            / v_new_quantity,
          4
        ),
        quantity = v_new_quantity,
        updated_at = now()
      where id = v_position.id;
    end if;
  else
    if v_position.id is null or v_position.quantity < v_order.quantity then
      update public.orders
      set status = 'rejected', reject_reason = 'Shares were already sold when the limit was reached.'
      where id = v_order.id;
      return false;
    end if;

    v_new_quantity := v_position.quantity - v_order.quantity;

    update public.portfolios
    set cash = cash + round(v_order.quantity * p_market_price, 2)
    where id = v_portfolio.id;

    update public.positions
    set
      quantity = v_new_quantity,
      avg_cost = case when v_new_quantity = 0 then 0 else v_position.avg_cost end,
      realized_pnl = realized_pnl
        + round(v_order.quantity * (p_market_price - v_position.avg_cost), 2),
      updated_at = now()
    where id = v_position.id;
  end if;

  update public.orders
  set status = 'filled', filled_price = p_market_price, filled_at = now()
  where id = v_order.id;

  return true;
end;
$$;

/**
 * Writes today's equity for every portfolio, valuing positions from the shared
 * quote cache. Called by the scheduled sweep; re-running it the same day just
 * updates the row.
 */
create or replace function public.snapshot_portfolios()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  with valued as (
    select
      p.id as portfolio_id,
      p.user_id,
      p.cash,
      coalesce(
        sum(pos.quantity * coalesce(q.price, pos.avg_cost)),
        0
      )::numeric(16, 2) as positions_value
    from public.portfolios p
    left join public.positions pos
      on pos.portfolio_id = p.id and pos.quantity > 0
    left join public.quote_cache q on q.symbol = pos.symbol
    group by p.id, p.user_id, p.cash
  )
  insert into public.portfolio_snapshots (
    portfolio_id, user_id, captured_on, equity, cash, positions_value
  )
  select
    portfolio_id,
    user_id,
    current_date,
    cash + positions_value,
    cash,
    positions_value
  from valued
  on conflict (portfolio_id, captured_on) do update
    set
      equity = excluded.equity,
      cash = excluded.cash,
      positions_value = excluded.positions_value;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- The client may call these two; the sweep functions stay service-role only.
revoke all on function public.fill_pending_order(uuid, numeric) from public, anon, authenticated;
revoke all on function public.snapshot_portfolios() from public, anon, authenticated;
