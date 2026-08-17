/**
 * Bounded parallelism. Firing 40 watchlist symbols at a 60 request/minute API
 * simultaneously trips the limiter; a small pool keeps throughput without the
 * burst.
 */
export async function mapWithConcurrency<TInput, TOutput>(
  items: readonly TInput[],
  limit: number,
  worker: (item: TInput) => Promise<TOutput>,
): Promise<PromiseSettledResult<TOutput>[]> {
  const results: PromiseSettledResult<TOutput>[] = new Array(items.length);
  let cursor = 0;

  async function run(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      try {
        results[index] = { status: 'fulfilled', value: await worker(items[index]) };
      } catch (reason) {
        results[index] = { status: 'rejected', reason };
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}
