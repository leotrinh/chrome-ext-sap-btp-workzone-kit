import { useMemo, useState } from "react";
import { useAppScan } from "../hooks/useAppScan";
import { useAppSelection } from "../hooks/useAppSelection";
import { useBulkUpdate } from "../hooks/useBulkUpdate";
import { SearchBox } from "./SearchBox";
import { SortMenu, type SortColumn, type SortDirection } from "./SortMenu";
import { VersionInput } from "./VersionInput";
import { AppsTable } from "./AppsTable";
import { ConfirmDialog } from "./ConfirmDialog";
import { UpdatePreview } from "./UpdatePreview";
import { UpdateProgress } from "./UpdateProgress";
import type { AppRowData } from "../../domain/app-row";
import { createUi5VersionUpdatePlan, summarizeUpdatePlans, type Ui5VersionUpdatePlan } from "../../domain/update-plan";

const DEFAULT_TARGET_VERSION = "1.136.17";
// Stable reference for the "no scan data yet" case — a fresh `[]` literal on every
// render would defeat the `rows` useMemo below just as much as an unmemoized `baseRows`
// would, re-triggering AppsTable's visibleRows -> onVisibleIdsChange -> setVisibleIds
// chain every render.
const EMPTY_ROWS: AppRowData[] = [];

export function AppsPanel() {
  const [globalTargetVersion, setGlobalTargetVersion] = useState(DEFAULT_TARGET_VERSION);
  const { state, scan, cancel } = useAppScan(globalTargetVersion);
  const selection = useAppSelection();
  const bulkUpdate = useBulkUpdate();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortColumn, setSortColumn] = useState<SortColumn>("title");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [visibleIds, setVisibleIds] = useState<string[]>([]);
  const [rowOverrides, setRowOverrides] = useState<Record<string, string>>({});
  const [pendingPlans, setPendingPlans] = useState<Ui5VersionUpdatePlan[] | null>(null);
  const [showProgress, setShowProgress] = useState(false);

  const baseRows: AppRowData[] =
    state.status === "loading_details" || state.status === "ready" ? state.rows : EMPTY_ROWS;
  // Memoized so this array's identity is stable across renders that don't actually
  // change the data — AppsTable's own useMemo/useEffect chain (visibleRows ->
  // onVisibleIdsChange -> setVisibleIds in this component) would otherwise re-fire on
  // every render of a fresh array here, causing an unbounded render loop the moment
  // any rows exist.
  const rows: AppRowData[] = useMemo(
    () => baseRows.map((row) => ({ ...row, targetVersion: rowOverrides[row.id] ?? row.targetVersion })),
    [baseRows, rowOverrides],
  );
  const rowsById = useMemo(() => new Map(rows.map((row) => [row.id, row])), [rows]);

  const isScanning = state.status === "scanning" || state.status === "loading_details";
  const isUpdating = bulkUpdate.state === "updating";

  function handleTargetVersionChange(id: string, value: string): void {
    setRowOverrides((current) => ({ ...current, [id]: value }));
  }

  function applyGlobalToSelected(): void {
    setRowOverrides((current) => {
      const next = { ...current };
      for (const id of selection.selected) {
        next[id] = globalTargetVersion;
      }
      return next;
    });
  }

  function handleSortChange(column: SortColumn, direction: SortDirection): void {
    setSortColumn(column);
    setSortDirection(direction);
  }

  function openPreview(): void {
    const plans = Array.from(selection.selected)
      .map((id) => rowsById.get(id))
      .filter((row): row is AppRowData => row !== undefined && row.status === "ready")
      .map((row) =>
        createUi5VersionUpdatePlan(row.id, row.title, row.detection ?? { displayVersion: null, targets: [], consistency: "none" }, row.targetVersion),
      );
    setPendingPlans(plans);
  }

  async function confirmUpdate(): Promise<void> {
    if (!pendingPlans) {
      return;
    }
    const plans = pendingPlans;
    setPendingPlans(null);
    setShowProgress(true);
    await bulkUpdate.run(plans);
  }

  const summary = pendingPlans ? summarizeUpdatePlans(pendingPlans) : null;

  return (
    <div className="apps-panel">
      <div className="apps-panel__toolbar">
        <button type="button" onClick={() => void scan()} disabled={isScanning}>
          {isScanning ? "Scanning…" : "Scan Applications"}
        </button>
        {isScanning && (
          <button type="button" onClick={cancel}>
            Cancel
          </button>
        )}
        <VersionInput label="Target UI5 Version:" value={globalTargetVersion} onChange={setGlobalTargetVersion} />
        <button type="button" onClick={applyGlobalToSelected} disabled={selection.selected.size === 0}>
          Apply to selected ({selection.selected.size})
        </button>
        <button type="button" onClick={openPreview} disabled={selection.selected.size === 0 || isUpdating}>
          Update Selected
        </button>
      </div>

      {state.status === "error" && (
        <p className="apps-panel__error" role="alert">
          {state.message}
        </p>
      )}

      {rows.length > 0 && (
        <div className="apps-panel__filters">
          <SearchBox value={searchQuery} onChange={setSearchQuery} />
          <SortMenu column={sortColumn} direction={sortDirection} onChange={handleSortChange} />
          <button
            type="button"
            onClick={() => selection.selectVisible(visibleIds)}
            disabled={visibleIds.length === 0}
          >
            Select all visible
          </button>
          <button type="button" onClick={selection.clear} disabled={selection.selected.size === 0}>
            Clear selection
          </button>
        </div>
      )}

      <AppsTable
        rows={rows}
        searchQuery={searchQuery}
        sortColumn={sortColumn}
        sortDirection={sortDirection}
        selected={selection.selected}
        onToggleSelected={selection.toggle}
        onTargetVersionChange={handleTargetVersionChange}
        onVisibleIdsChange={setVisibleIds}
      />

      {pendingPlans && summary && (
        <ConfirmDialog
          title="Update UI5 Version Configuration?"
          confirmLabel={`Update ${summary.changingCount} Application${summary.changingCount === 1 ? "" : "s"}`}
          confirmDisabled={summary.changingCount === 0}
          onCancel={() => setPendingPlans(null)}
          onConfirm={() => void confirmUpdate()}
        >
          <UpdatePreview summary={summary} />
        </ConfirmDialog>
      )}

      {showProgress && (
        <UpdateProgress
          results={bulkUpdate.results}
          isRunning={isUpdating}
          onClose={() => {
            setShowProgress(false);
            bulkUpdate.reset();
          }}
        />
      )}
    </div>
  );
}
