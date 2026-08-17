import { FunctionsHttpError } from '@supabase/supabase-js';
import type { z, ZodType } from 'zod';

import { ApiError } from '@/lib/api-error';
import { supabase } from '@/lib/supabase';

type FunctionErrorEnvelope = {
  error?: { code?: string; message?: string };
};

/**
 * Calls a Supabase Edge Function and validates the response.
 *
 * Functions return a uniform `{ error: { code, message } }` envelope on failure;
 * this unwraps it into an `ApiError` so screens can branch on things like
 * `isRateLimited` or `isQuotaExhausted` instead of string matching.
 */
export async function invokeFunction<TSchema extends ZodType>(
  name: string,
  body: Record<string, unknown>,
  schema: TSchema,
): Promise<z.output<TSchema>> {
  const { data, error } = await supabase.functions.invoke(name, { body });

  if (error) {
    if (error instanceof FunctionsHttpError) {
      const payload = (await error.context
        .json()
        .catch(() => null)) as FunctionErrorEnvelope | null;
      throw new ApiError(payload?.error?.message ?? 'The server rejected the request.', {
        status: error.context.status,
        code: payload?.error?.code,
        cause: error,
      });
    }
    throw new ApiError(error.message || 'Could not reach the server.', { cause: error });
  }

  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    // A schema mismatch means the function and app disagree; surfacing it as an
    // error beats rendering `undefined` deep in the UI.
    throw new ApiError('Unexpected response from the server.', {
      code: 'invalid_response',
      cause: parsed.error,
    });
  }

  return parsed.data;
}
