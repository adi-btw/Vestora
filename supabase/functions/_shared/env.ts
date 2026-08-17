import { HttpError } from './http.ts';

/**
 * Reads a secret set with `supabase secrets set`. Failing loudly with a 500 and a
 * precise name beats a confusing upstream 401 later.
 */
export function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new HttpError(
      500,
      'missing_configuration',
      `${name} is not configured on this Supabase project.`,
    );
  }
  return value;
}

export function optionalEnv(name: string): string | null {
  return Deno.env.get(name) ?? null;
}
