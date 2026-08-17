import {
  refreshResponseSchema,
  signalsSchema,
  type Recommendation,
} from '@/features/recommendations/schemas';
import type { RecommendationRow } from '@/lib/database.types';
import { invokeFunction } from '@/lib/functions';
import { supabase } from '@/lib/supabase';

const FUNCTION_NAME = 'recommend';

/** Stored rows are read straight from Postgres; only refreshing needs the function. */
export async function fetchRecommendations(): Promise<Recommendation[]> {
  const { data, error } = await supabase
    .from('recommendations')
    .select('*')
    .is('dismissed_at', null)
    .order('score', { ascending: false });

  if (error) throw error;

  return ((data ?? []) as RecommendationRow[]).map((row) => ({
    symbol: row.symbol,
    score: Number(row.score),
    thesis: row.thesis,
    risks: row.risks,
    confidence: Number(row.confidence),
    // Older rows may predate a signals shape change, so fall back to empty.
    signals: signalsSchema.catch({ factors: [] }).parse(row.signals),
    generatedAt: row.generated_at,
  }));
}

export function refreshRecommendations() {
  return invokeFunction(FUNCTION_NAME, {}, refreshResponseSchema);
}

export async function dismissRecommendation(symbol: string): Promise<void> {
  const { error } = await supabase
    .from('recommendations')
    .update({ dismissed_at: new Date().toISOString() })
    .eq('symbol', symbol);

  if (error) throw error;
}
