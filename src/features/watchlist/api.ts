import type { WatchlistItemRow, WatchlistRow } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

/**
 * Reads the user's default list, creating one if the sign-up trigger never ran
 * (for example on a project seeded before the trigger existed).
 */
export async function fetchDefaultWatchlist(userId: string): Promise<WatchlistRow> {
  const { data, error } = await supabase
    .from('watchlists')
    .select('*')
    .eq('user_id', userId)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (data) return data;

  const { data: created, error: createError } = await supabase
    .from('watchlists')
    .insert({ user_id: userId, name: 'My watchlist', is_default: true })
    .select()
    .single();

  if (createError) throw createError;
  return created;
}

export async function fetchWatchlistItems(watchlistId: string): Promise<WatchlistItemRow[]> {
  const { data, error } = await supabase
    .from('watchlist_items')
    .select('*')
    .eq('watchlist_id', watchlistId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function addWatchlistItem(params: {
  watchlistId: string;
  userId: string;
  symbol: string;
  sortOrder: number;
}): Promise<WatchlistItemRow> {
  const { data, error } = await supabase
    .from('watchlist_items')
    .insert({
      watchlist_id: params.watchlistId,
      user_id: params.userId,
      symbol: params.symbol.toUpperCase(),
      sort_order: params.sortOrder,
    })
    .select()
    .single();

  if (error) {
    // 23505 is the unique violation from `watchlist_items_unique_symbol`.
    if (error.code === '23505') {
      throw new Error(`${params.symbol.toUpperCase()} is already on this watchlist.`);
    }
    throw error;
  }

  return data;
}

export async function removeWatchlistItem(itemId: string): Promise<void> {
  const { error } = await supabase.from('watchlist_items').delete().eq('id', itemId);
  if (error) throw error;
}

export async function updateWatchlistItemNotes(itemId: string, notes: string): Promise<void> {
  const { error } = await supabase
    .from('watchlist_items')
    .update({ notes: notes.trim() || null })
    .eq('id', itemId);

  if (error) throw error;
}
