export type SortColumn = "title" | "currentVersion";
export type SortDirection = "asc" | "desc";

interface SortMenuProps {
  column: SortColumn;
  direction: SortDirection;
  onChange: (column: SortColumn, direction: SortDirection) => void;
}

const COLUMNS: Array<{ value: SortColumn; label: string }> = [
  { value: "title", label: "App Name" },
  { value: "currentVersion", label: "Current UI5" },
];

export function SortMenu({ column, direction, onChange }: SortMenuProps) {
  return (
    <div className="sort-menu">
      <label>
        Sort by{" "}
        <select
          value={column}
          onChange={(event) => onChange(event.target.value as SortColumn, direction)}
        >
          {COLUMNS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        className="btn btn--ghost btn--sm"
        onClick={() => onChange(column, direction === "asc" ? "desc" : "asc")}
        aria-label={`Sort ${direction === "asc" ? "ascending" : "descending"}`}
      >
        {direction === "asc" ? "↑" : "↓"}
      </button>
    </div>
  );
}
