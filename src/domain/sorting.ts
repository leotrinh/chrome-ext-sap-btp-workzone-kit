export function compareAppTitle(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: "base" });
}

/**
 * Semantic-ish version comparison (blueprint §3.8/§14): splits on `.`/`-`/`+` and
 * compares each segment numerically when both sides are numeric, falling back to
 * string comparison otherwise (pre-release suffixes etc.). Produces the blueprint's
 * exact required ordering: 1.9.0 < 1.10.0 < 1.100.0 < 1.136.17 — plain string sort
 * would get this wrong (lexicographic "1.10.0" < "1.9.0").
 *
 * This is an ascending-only comparator: `null` sorts last here, but a caller that
 * negates the whole result to sort descending (e.g. `.sort((a, b) => -compare(a, b))`)
 * will also flip the null placement to "first", which is wrong for a UI status column.
 * Use `compareUi5VersionForSort()` below for a direction toggle that keeps `null`
 * pinned last regardless of ascending/descending.
 */
export function compareUi5Version(a: string | null, b: string | null): number {
  if (a === null && b === null) {
    return 0;
  }
  if (a === null) {
    return 1;
  }
  if (b === null) {
    return -1;
  }

  const segmentsA = a.split(/[.\-+]/);
  const segmentsB = b.split(/[.\-+]/);
  const length = Math.max(segmentsA.length, segmentsB.length);

  for (let i = 0; i < length; i++) {
    const segmentA = segmentsA[i];
    const segmentB = segmentsB[i];
    if (segmentA === undefined) {
      return -1;
    }
    if (segmentB === undefined) {
      return 1;
    }

    const numA = Number(segmentA);
    const numB = Number(segmentB);
    const bothNumeric = segmentA !== "" && segmentB !== "" && !Number.isNaN(numA) && !Number.isNaN(numB);

    if (bothNumeric) {
      if (numA !== numB) {
        return numA - numB;
      }
    } else {
      const comparison = segmentA.localeCompare(segmentB);
      if (comparison !== 0) {
        return comparison;
      }
    }
  }

  return 0;
}

/**
 * Direction-aware wrapper for table sorting: `null` (no detected version) always
 * sorts last, whether the column is ascending or descending — only the ordering among
 * apps that actually have a version flips with direction. Matches the source
 * userscript's "group value vs N/A" sort behavior (blueprint §14).
 */
export function compareUi5VersionForSort(
  a: string | null,
  b: string | null,
  direction: "asc" | "desc",
): number {
  if (a === null && b === null) {
    return 0;
  }
  if (a === null) {
    return 1;
  }
  if (b === null) {
    return -1;
  }

  const base = compareUi5Version(a, b);
  return direction === "asc" ? base : -base;
}
