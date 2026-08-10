import { describe, expect, it } from "vitest";
import { mapWithConcurrency } from "../../src/shared/concurrency";

describe("mapWithConcurrency()", () => {
  it("never exceeds the concurrency limit", async () => {
    let active = 0;
    let maxActive = 0;
    const items = Array.from({ length: 12 }, (_, i) => i);

    await mapWithConcurrency(items, 5, async (item) => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active--;
      return item * 2;
    });

    expect(maxActive).toBeLessThanOrEqual(5);
  });

  it("preserves result order regardless of completion order", async () => {
    const items = [30, 10, 20];
    const result = await mapWithConcurrency(items, 2, async (item) => {
      await new Promise((resolve) => setTimeout(resolve, item / 10));
      return item;
    });
    expect(result).toEqual([30, 10, 20]);
  });

  it("handles an empty list", async () => {
    const result = await mapWithConcurrency([] as number[], 5, async (x) => x);
    expect(result).toEqual([]);
  });

  it("handles a limit greater than the item count", async () => {
    const result = await mapWithConcurrency([1, 2], 10, async (x) => x * 2);
    expect(result).toEqual([2, 4]);
  });

  it("processes every item exactly once", async () => {
    const seen: number[] = [];
    await mapWithConcurrency([1, 2, 3, 4, 5], 3, async (item) => {
      seen.push(item);
      return item;
    });
    expect(seen.sort()).toEqual([1, 2, 3, 4, 5]);
  });
});
