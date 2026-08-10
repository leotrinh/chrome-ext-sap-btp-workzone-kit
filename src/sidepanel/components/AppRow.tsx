import { currentVersionText, type AppRowData } from "../../domain/app-row";
import { VersionInput } from "./VersionInput";

interface AppRowProps {
  row: AppRowData;
  selected: boolean;
  onToggleSelected: (id: string) => void;
  onTargetVersionChange: (id: string, value: string) => void;
}

export function AppRow({ row, selected, onToggleSelected, onTargetVersionChange }: AppRowProps) {
  const versionText = currentVersionText(row);
  const badgeClass =
    row.status === "error"
      ? "version-badge version-badge--error"
      : versionText === "N/A"
        ? "version-badge version-badge--na"
        : versionText.startsWith("Mixed")
          ? "version-badge version-badge--mixed"
          : "version-badge version-badge--set";

  return (
    <tr>
      <td>
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleSelected(row.id)}
          aria-label={`Select ${row.title}`}
        />
      </td>
      <td>
        <div className="app-row__title">{row.title}</div>
        <div className="app-row__id">{row.id}</div>
      </td>
      <td>
        <span className={badgeClass}>{versionText}</span>
        {row.status === "ready" && (row.detection?.targets.length ?? 0) > 0 && (
          <span className="app-row__target-count">{row.detection?.targets.length} target(s)</span>
        )}
      </td>
      <td>
        <VersionInput
          value={row.targetVersion}
          onChange={(value) => onTargetVersionChange(row.id, value)}
          disabled={row.status !== "ready"}
          compact
        />
      </td>
      <td>
        <span className={`status-pill status-pill--${row.status === "loading" ? "loading" : row.status === "error" ? "error" : "ready"}`}>
          {row.status === "loading" ? "Loading" : row.status === "error" ? "Error" : "Ready"}
        </span>
      </td>
    </tr>
  );
}
