import { useEffect, useMemo } from "react";
import { compareAppTitle, compareUi5VersionForSort } from "../../domain/sorting";
import { matchesSearch } from "../../domain/search";
import { currentVersionText, type AppRowData } from "../../domain/app-row";
import { AppRow } from "./AppRow";
import type { SortColumn, SortDirection } from "./SortMenu";

interface AppsTableProps {
  rows: AppRowData[];
  searchQuery: string;
  sortColumn: SortColumn;
  sortDirection: SortDirection;
  selected: ReadonlySet<string>;
  onToggleSelected: (id: string) => void;
  onTargetVersionChange: (id: string, value: string) => void;
  onVisibleIdsChange?: (visibleIds: string[]) => void;
}

export function AppsTable({
  rows,
  searchQuery,
  sortColumn,
  sortDirection,
  selected,
  onToggleSelected,
  onTargetVersionChange,
  onVisibleIdsChange,
}: AppsTableProps) {
  const visibleRows = useMemo(() => {
    const filtered = rows.filter((row) =>
      matchesSearch({ title: row.title, currentVersionText: currentVersionText(row) }, searchQuery),
    );

    const titleMultiplier = sortDirection === "asc" ? 1 : -1;
    const sorted = [...filtered].sort((a, b) =>
      sortColumn === "title"
        ? compareAppTitle(a.title, b.title) * titleMultiplier
        : compareUi5VersionForSort(
            a.detection?.displayVersion ?? null,
            b.detection?.displayVersion ?? null,
            sortDirection,
          ),
    );

    return sorted;
  }, [rows, searchQuery, sortColumn, sortDirection]);

  useEffect(() => {
    onVisibleIdsChange?.(visibleRows.map((row) => row.id));
  }, [visibleRows, onVisibleIdsChange]);

  if (rows.length === 0) {
    return <p className="apps-table__empty">No apps loaded yet. Click "Scan Applications" to start.</p>;
  }

  if (visibleRows.length === 0) {
    return <p className="apps-table__empty">No apps match "{searchQuery}".</p>;
  }

  return (
    <table className="apps-table">
      <thead>
        <tr>
          <th />
          <th>Application</th>
          <th>Current UI5</th>
          <th>Target UI5</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {visibleRows.map((row) => (
          <AppRow
            key={row.id}
            row={row}
            selected={selected.has(row.id)}
            onToggleSelected={onToggleSelected}
            onTargetVersionChange={onTargetVersionChange}
          />
        ))}
      </tbody>
    </table>
  );
}
