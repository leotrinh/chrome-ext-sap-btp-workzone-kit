/**
 * Runs `mapper` over `items` with at most `limit` concurrent in-flight calls,
 * preserving result order. Used for SAP app-detail fetches (blueprint's fixed
 * concurrency of 5) — never `Promise.all` across an unbounded list.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) {
    return [];
  }

  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    for (;;) {
      const index = nextIndex++;
      if (index >= items.length) {
        return;
      }
      // Safe: index < items.length was just checked.
      results[index] = await mapper(items[index] as T, index);
    }
  }

  const workerCount = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}
