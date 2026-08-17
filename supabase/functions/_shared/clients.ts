import { createClient, type SupabaseClient } from './deps.ts';
import { requireEnv } from './env.ts';
import { HttpError } from './http.ts';

/**
 * Client that inherits the caller's JWT, so every query it runs is still subject
 * to RLS. Use this for anything reading or writing user-owned rows.
 */
export function createUserClient(request: Request): SupabaseClient {
  const authorization = request.headers.get('Authorization');
  if (!authorization) {
    throw new HttpError(401, 'missing_authorization', 'Missing Authorization header.');
  }

  return createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Service-role client that bypasses RLS. Restricted to shared caches, rate-limit
 * counters and cron-driven work - never used to read one user's data on behalf
 * of another.
 */
export function createServiceClient(): SupabaseClient {
  return createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type AuthenticatedContext = {
  userId: string;
  /** RLS-scoped client for this user. */
  db: SupabaseClient;
  /** Service-role client for shared infrastructure tables. */
  admin: SupabaseClient;
};

export async function requireUser(request: Request): Promise<AuthenticatedContext> {
  const db = createUserClient(request);
  const { data, error } = await db.auth.getUser();

  if (error || !data.user) {
    throw new HttpError(401, 'unauthorized', 'Sign in to use this endpoint.');
  }

  return { userId: data.user.id, db, admin: createServiceClient() };
}
