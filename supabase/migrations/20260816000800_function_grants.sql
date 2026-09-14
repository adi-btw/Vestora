-- Tighten SECURITY DEFINER grants after the first deploy.
-- Triggers still run as the table owner; clients only need the two RPCs below.

alter function public.set_updated_at() set search_path = public;

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.touch_chat_thread() from public, anon, authenticated;

revoke all on function public.ensure_portfolio() from public, anon;
grant execute on function public.ensure_portfolio() to authenticated;

revoke all on function public.place_paper_order(text, text, text, numeric, numeric, numeric) from public, anon;
grant execute on function public.place_paper_order(text, text, text, numeric, numeric, numeric) to authenticated;
