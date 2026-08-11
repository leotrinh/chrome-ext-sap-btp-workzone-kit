import { useEffect } from "react";
import type { Ui5VersionUpdateResult } from "../../domain/update-result";

interface UpdateProgressProps {
  results: Map<string, Ui5VersionUpdateResult>;
  onClose: () => void;
  isRunning: boolean;
}

const STATUS_LABEL: Record<Ui5VersionUpdateResult["status"], string> = {
  pending: "Pending",
  updating: "Updating…",
  updated: "Updated",
  verifying: "Verifying…",
  verified: "Updated + Verified",
  failed: "Failed",
  skipped: "Skipped (already configured)",
  unknown: "Not attempted",
};

function displayLabel(entry: Ui5VersionUpdateResult): string {
  if (entry.status === "updated" && entry.verificationStatus) {
    if (entry.verificationStatus === "mismatch") {
      return "Updated, verification mismatch";
    }
    if (entry.verificationStatus === "not_verifiable" || entry.verificationStatus === "verification_failed") {
      return "Updated, verification unavailable";
    }
  }
  return STATUS_LABEL[entry.status];
}

export function UpdateProgress({ results, onClose, isRunning }: UpdateProgressProps) {
  const entries = Array.from(results.values());
  const doneCount = entries.filter((entry) => entry.status !== "pending" && entry.status !== "updating").length;

  // Rendered as a fixed-position overlay (like ConfirmDialog/Ui5VersionOverviewModal) —
  // not inline in the panel flow — so it stays visible above the apps table regardless
  // of how many rows a real-tenant scan produced. Previously this rendered as a plain
  // block appended after <AppsTable>, which pushed it below the side panel's visible
  // viewport once the table had more than a handful of rows, making a completed update
  // look like it silently produced no message.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape" && !isRunning) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isRunning, onClose]);

  return (
    <div
      className="confirm-dialog__backdrop"
      role="presentation"
      onClick={() => {
        if (!isRunning) {
          onClose();
        }
      }}
    >
      <div
        className="update-progress"
        role="status"
        aria-live="polite"
        onClick={(event) => event.stopPropagation()}
      >
        <p>
          {isRunning
            ? `Updating… ${doneCount}/${entries.length} processed`
            : `Finished: ${doneCount}/${entries.length} processed`}
        </p>
        <ul>
          {entries.map((entry) => (
            <li key={entry.appId} className="update-progress__item">
              <span>{entry.appId}</span>
              <span className={`status-pill status-pill--${entry.status}`}>{displayLabel(entry)}</span>
              {entry.errorMessage && <span className="update-progress__error">{entry.errorMessage}</span>}
            </li>
          ))}
        </ul>
        <button type="button" className="btn btn--ghost" onClick={onClose} disabled={isRunning}>
          Close
        </button>
      </div>
    </div>
  );
}
