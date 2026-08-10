import { useCallback, useRef, useState } from "react";
import type { WorkzoneAppSummary } from "../../integrations/sap-workzone/app-list";
import type { AppVersionTargetsEntry } from "../../page-runtime/command-handler";
import type { AppRowData } from "../../domain/app-row";
import { sendWorkzoneCommand } from "./useWorkzoneCommand";

export type ScanState =
  | { status: "idle" }
  | { status: "scanning" }
  | { status: "loading_details"; rows: AppRowData[] }
  | { status: "ready"; rows: AppRowData[] }
  | { status: "error"; message: string };

function toInitialRow(app: WorkzoneAppSummary, defaultTargetVersion: string): AppRowData {
  return { id: app.id, title: app.title, baseId: app.baseId, status: "loading", targetVersion: defaultTargetVersion };
}

function applyDetailEntry(row: AppRowData, entry: AppVersionTargetsEntry): AppRowData {
  if (entry.error) {
    return { ...row, status: "error", errorMessage: entry.error.message };
  }
  return { ...row, status: "ready", detection: entry.detection };
}

export function useAppScan(defaultTargetVersion: string): {
  state: ScanState;
  scan: () => Promise<void>;
  cancel: () => void;
} {
  const [state, setState] = useState<ScanState>({ status: "idle" });
  const cancelledRef = useRef(false);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    setState({ status: "idle" });
  }, []);

  const scan = useCallback(async () => {
    cancelledRef.current = false;
    setState({ status: "scanning" });

    const listResponse = await sendWorkzoneCommand<{ apps: WorkzoneAppSummary[] }>("SCAN_APPS");
    if (cancelledRef.current) {
      return;
    }
    if (!listResponse.ok) {
      setState({ status: "error", message: listResponse.error.message });
      return;
    }

    const initialRows = listResponse.data.apps.map((app) => toInitialRow(app, defaultTargetVersion));
    if (initialRows.length === 0) {
      setState({ status: "ready", rows: [] });
      return;
    }

    setState({ status: "loading_details", rows: initialRows });

    const detailResponse = await sendWorkzoneCommand<{ results: AppVersionTargetsEntry[] }>(
      "GET_APP_VERSION_TARGETS",
      { appIds: initialRows.map((row) => row.id) },
    );
    if (cancelledRef.current) {
      return;
    }
    if (!detailResponse.ok) {
      setState({ status: "error", message: detailResponse.error.message });
      return;
    }

    const entryByAppId = new Map(detailResponse.data.results.map((entry) => [entry.appId, entry]));
    const finalRows = initialRows.map((row) => {
      const entry = entryByAppId.get(row.id);
      return entry ? applyDetailEntry(row, entry) : { ...row, status: "error" as const, errorMessage: "No detail returned." };
    });

    setState({ status: "ready", rows: finalRows });
  }, [defaultTargetVersion]);

  return { state, scan, cancel };
}
