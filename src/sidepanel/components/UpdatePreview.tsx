import type { UpdatePlanSummary } from "../../domain/update-plan";

interface UpdatePreviewProps {
  summary: UpdatePlanSummary;
}

/** Blueprint §17's exact confirmation text template. */
export function UpdatePreview({ summary }: UpdatePreviewProps) {
  return (
    <div className="update-preview">
      <dl>
        <div>
          <dt>Apps selected</dt>
          <dd>{summary.selectedCount}</dd>
        </div>
        <div>
          <dt>Apps changing</dt>
          <dd>{summary.changingCount}</dd>
        </div>
        <div>
          <dt>Already configured</dt>
          <dd>{summary.alreadyConfiguredCount}</dd>
        </div>
        <div>
          <dt>Unsupported</dt>
          <dd>{summary.unsupportedCount}</dd>
        </div>
      </dl>

      {summary.targetVersionBreakdown.length > 0 && (
        <>
          <p className="update-preview__breakdown-label">Target versions:</p>
          <ul className="update-preview__breakdown">
            {summary.targetVersionBreakdown.map((entry) => (
              <li key={entry.targetVersion}>
                {entry.targetVersion} → {entry.appCount} {entry.appCount === 1 ? "app" : "apps"}
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="update-preview__notice">
        This will modify SAP BTP Work Zone application configuration using your current
        signed-in SAP account.
      </p>
    </div>
  );
}
