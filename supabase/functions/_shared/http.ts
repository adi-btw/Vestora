export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/** An error with an HTTP status and a stable machine-readable code. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', ...headers },
  });
}

export function errorResponse(error: unknown) {
  if (error instanceof HttpError) {
    return jsonResponse(
      { error: { code: error.code, message: error.message } },
      error.status,
      error.retryAfterSeconds ? { 'Retry-After': String(error.retryAfterSeconds) } : {},
    );
  }

  console.error('Unhandled function error', error);
  const message = error instanceof Error ? error.message : 'Unexpected error';
  return jsonResponse({ error: { code: 'internal_error', message } }, 500);
}

export function handlePreflight(request: Request): Response | null {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (request.method !== 'POST') {
    return jsonResponse({ error: { code: 'method_not_allowed', message: 'Use POST.' } }, 405, {
      Allow: 'POST, OPTIONS',
    });
  }
  return null;
}

/**
 * Wraps a handler with preflight handling and uniform error serialisation so
 * every function returns the same error envelope the client parses.
 */
export function serveJson(handler: (request: Request) => Promise<Response>) {
  return async (request: Request): Promise<Response> => {
    const preflight = handlePreflight(request);
    if (preflight) return preflight;

    try {
      return await handler(request);
    } catch (error) {
      return errorResponse(error);
    }
  };
}

export async function parseJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, 'invalid_json', 'Request body must be valid JSON.');
  }
}
