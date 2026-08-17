/**
 * Client-side configuration.
 *
 * Only `EXPO_PUBLIC_*` values belong here: they are inlined into the JavaScript
 * bundle and are therefore readable by anyone with the app. Provider secrets
 * (Finnhub, Alpaca, Gemini) live exclusively in Supabase Edge Function secrets.
 */

export const env = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
} as const;

/**
 * The app renders a setup screen instead of crashing when the Supabase project
 * has not been wired up yet, so a fresh clone is still runnable.
 */
export const isSupabaseConfigured = Boolean(env.supabaseUrl && env.supabaseAnonKey);

export const missingEnvKeys = (
  [
    ['EXPO_PUBLIC_SUPABASE_URL', env.supabaseUrl],
    ['EXPO_PUBLIC_SUPABASE_ANON_KEY', env.supabaseAnonKey],
  ] as const
)
  .filter(([, value]) => !value)
  .map(([key]) => key);
