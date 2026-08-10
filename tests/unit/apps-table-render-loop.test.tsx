import { render } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { AppsTable } from "../../src/sidepanel/components/AppsTable";
import type { AppRowData } from "../../src/domain/app-row";

function makeRow(id: string): AppRowData {
  return {
    id,
    title: id,
    baseId: null,
    status: "ready",
    targetVersion: "1.136.17",
    detection: { displayVersion: "1.136.17", targets: [], consistency: "single" },
  };
}

/**
 * Regression test for a critical bug: AppsPanel used to build the `rows` array prop
 * fresh on every render (no useMemo). AppsTable's internal `visibleRows` useMemo
 * depends on `rows`, and its useEffect (which calls `onVisibleIdsChange` -> parent
 * `setVisibleIds`) depends on `visibleRows`. A fresh `rows` reference every render
 * meant: new visibleRows -> effect fires -> setVisibleIds -> parent re-renders -> new
 * `rows` reference again -> unbounded loop, hanging the panel the moment any row
 * existed. Fixed by memoizing `rows` (and its "no data yet" fallback) in AppsPanel.
 * This test proves the effect settles when given a STABLE rows reference — the
 * contract AppsPanel must uphold — rather than re-testing AppsPanel's internals
 * directly (which would require mocking its whole hook chain).
 */
describe("AppsTable — visible-ids effect settles with a stable rows reference", () => {
  it("calls onVisibleIdsChange exactly once for a stable rows array, never loops", () => {
    let callCount = 0;
    let lastVisibleIds: string[] = [];

    function Harness() {
      // useState's lazy initializer keeps this array reference stable across
      // re-renders — mirrors what AppsPanel's memoized `rows` now guarantees.
      const [rows] = useState<AppRowData[]>(() => [makeRow("a"), makeRow("b")]);
      const [selected] = useState<ReadonlySet<string>>(() => new Set<string>());

      return (
        <AppsTable
          rows={rows}
          searchQuery=""
          sortColumn="title"
          sortDirection="asc"
          selected={selected}
          onToggleSelected={() => {}}
          onTargetVersionChange={() => {}}
          onVisibleIdsChange={(ids) => {
            callCount++;
            lastVisibleIds = ids;
          }}
        />
      );
    }

    render(<Harness />);

    expect(callCount).toBe(1);
    expect(lastVisibleIds).toEqual(["a", "b"]);
  });

  it("does not re-fire when the parent re-renders without the rows reference changing", () => {
    let callCount = 0;

    function Harness() {
      const [rows] = useState<AppRowData[]>(() => [makeRow("a")]);
      const [selected] = useState<ReadonlySet<string>>(() => new Set<string>());
      // A state value unrelated to rows — forces a re-render without changing rows.
      const [, forceRerender] = useState(0);

      return (
        <>
          <button type="button" onClick={() => forceRerender((n) => n + 1)}>
            rerender
          </button>
          <AppsTable
            rows={rows}
            searchQuery=""
            sortColumn="title"
            sortDirection="asc"
            selected={selected}
            onToggleSelected={() => {}}
            onTargetVersionChange={() => {}}
            onVisibleIdsChange={() => {
              callCount++;
            }}
          />
        </>
      );
    }

    const { getByText } = render(<Harness />);
    expect(callCount).toBe(1);

    getByText("rerender").click();
    getByText("rerender").click();
    getByText("rerender").click();

    // Still 1: rows/searchQuery/sortColumn/sortDirection never changed, so
    // AppsTable's internal useMemo must return the same visibleRows reference and
    // the effect must not re-fire.
    expect(callCount).toBe(1);
  });
});
