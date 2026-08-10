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

  return (
    <div className="update-progress" role="status" aria-live="polite">
      <p>
        {isRunning
          ? `Updating… ${doneCount}/${entries.length} processed`
          : `Finished: ${doneCount}/${entries.length} processed`}
      </p>
      <ul>
        {entries.map((entry) => (
          <li key={entry.appId} className={`update-progress__item update-progress__item--${entry.status}`}>
            <span>{entry.appId}</span>
            <span>{displayLabel(entry)}</span>
            {entry.errorMessage && <span className="update-progress__error">{entry.errorMessage}</span>}
          </li>
        ))}
      </ul>
      <button type="button" onClick={onClose} disabled={isRunning}>
        Close
      </button>
    </div>
  );
}
