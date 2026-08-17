import { HttpError } from './http.ts';

type FetchJsonOptions = {
  /** Provider label used in error messages and logs. */
  provider: string;
  headers?: Record<string, string>;
  /** Extra attempts after the first, for 429 and 5xx only. */
  retries?: number;
  timeoutMs?: number;
  method?: 'GET' | 'POST';
  /** Serialised as JSON when present. */
  body?: unknown;
  /**
   * Lets a provider translate a failing response into a domain-specific error -
   * for example turning a Gemini 429 into `quota_exhausted`.
   */
  mapError?: (status: number, body: string) => HttpError | null;
};

const DEFAULT_TIMEOUT_MS = 8_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * The single outbound HTTP path for every provider: bounded timeout, capped
 * exponential backoff with jitter on transient failures, and 4xx surfaced
 * immediately because retrying a bad request only burns quota.
 */
export async function fetchJson<T>(url: string, options: FetchJsonOptions): Promise<T> {
  const {
    provider,
    headers = {},
    retries = 2,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    method = 'GET',
    body: requestBody,
    mapError,
  } = options;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method,
        headers: {
          Accept: 'application/json',
          ...(requestBody === undefined ? {} : { 'Content-Type': 'application/json' }),
          ...headers,
        },
        body: requestBody === undefined ? undefined : JSON.stringify(requestBody),
        signal: controller.signal,
      });

      if (response.ok) {
        return (await response.json()) as T;
      }

      const body = await response.text();
      const mapped = mapError?.(response.status, body);
      if (mapped) throw mapped;

      const transient = response.status === 429 || response.status >= 500;

      if (!transient) {
        throw new HttpError(
          response.status === 401 || response.status === 403 ? 502 : response.status,
          'provider_error',
          `${provider} rejected the request (${response.status}). ${body.slice(0, 180)}`,
        );
      }

      lastError = new HttpError(
        429,
        'provider_rate_limited',
        `${provider} is rate limiting requests. Try again shortly.`,
      );
    } catch (error) {
      // Mapped and non-transient provider errors are final; only transport-level
      // failures are worth another attempt.
      if (error instanceof HttpError && error.code !== 'provider_rate_limited') throw error;
      lastError =
        error instanceof Error && error.name === 'AbortError'
          ? new HttpError(504, 'provider_timeout', `${provider} timed out.`)
          : error;
    } finally {
      clearTimeout(timer);
    }

    if (attempt < retries) {
      await sleep(250 * 2 ** attempt + Math.random() * 150);
    }
  }

  throw lastError instanceof HttpError
    ? lastError
    : new HttpError(502, 'provider_unavailable', `${provider} is unavailable.`);
}
