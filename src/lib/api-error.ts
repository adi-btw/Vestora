export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, options: { status?: number; code?: string; cause?: unknown } = {}) {
    super(message, { cause: options.cause });
    this.name = 'ApiError';
    this.status = options.status ?? 0;
    this.code = options.code ?? 'unknown';
  }

  /** 429 and 5xx are worth another attempt; a bad request never is. */
  get isRetryable(): boolean {
    return this.status === 0 || this.status === 429 || this.status >= 500;
  }

  get isRateLimited(): boolean {
    return this.status === 429;
  }

  /** Signals that the daily AI quota is gone, so callers can degrade gracefully. */
  get isQuotaExhausted(): boolean {
    return this.code === 'quota_exhausted';
  }
}
