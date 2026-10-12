-- Mirror ensure_portfolio(): create the default watchlist from auth.uid() so
-- the client never has to guess an id, and a unique-constraint race becomes a
-- no-op instead of a 409 that leaves the query in an error state.

create or replace function public.ensure_watchlist()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_watchlist_id uuid;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  insert into public.watchlists (user_id, name, is_default)
  values (v_user_id, 'My watchlist', true)
  on conflict (user_id) where is_default do nothing;

  select id into v_watchlist_id
  from public.watchlists
  where user_id = v_user_id
  order by is_default desc, created_at asc
  limit 1;

  return v_watchlist_id;
end;
$$;

revoke all on function public.ensure_watchlist() from public, anon;
grant execute on function public.ensure_watchlist() to authenticated;

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
  values (new.id, 'My watchlist', true)
  on conflict (user_id) where is_default do nothing;

  insert into public.portfolios (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;
