// Stores an Expo push token for the signed-in user.
//
// Tokens rotate, so the client re-registers on every launch and this upserts by
// token, keeping `last_seen_at` fresh for pruning later.

import { requireUser } from '../_shared/clients.ts';
import { z } from '../_shared/deps.ts';
import { HttpError, jsonResponse, parseJsonBody, serveJson } from '../_shared/http.ts';

const requestSchema = z.object({
  token: z.string().trim().min(10).max(200),
  platform: z.enum(['ios', 'android', 'web', 'unknown']).default('unknown'),
});

Deno.serve(
  serveJson(async (request) => {
    const { userId, db } = await requireUser(request);

    const parsed = requestSchema.safeParse(await parseJsonBody(request));
    if (!parsed.success) {
      throw new HttpError(400, 'invalid_request', 'A valid Expo push token is required.');
    }

    const { error } = await db.from('push_tokens').upsert(
      {
        user_id: userId,
        token: parsed.data.token,
        platform: parsed.data.platform,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: 'token' },
    );

    if (error) throw new HttpError(500, 'token_write_failed', error.message);

    return jsonResponse({ registered: true });
  }),
);
