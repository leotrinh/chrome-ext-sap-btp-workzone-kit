import type { Ui5VersionDetection } from "./ui5-version";

export type AppRowStatus = "loading" | "ready" | "error";

export interface AppRowData {
  id: string;
  title: string;
  baseId: string | null;
  status: AppRowStatus;
  detection?: Ui5VersionDetection;
  errorMessage?: string;
  targetVersion: string;
}

/** What the table shows in the "Current UI5" column and what search/sort operate on. */
export function currentVersionText(row: AppRowData): string {
  if (row.status === "loading") {
    return "Loading";
  }
  if (row.status === "error") {
    return "Error";
  }
  switch (row.detection?.consistency) {
    case "single":
    case "consistent":
      return row.detection.displayVersion ?? "N/A";
    case "mixed":
      return `Mixed (${row.detection.targets.length} versions)`;
    case "none":
    default:
      return "N/A";
  }
}
