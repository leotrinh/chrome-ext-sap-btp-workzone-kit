import { useEffect, useRef, useState } from "react";
import { isValidVersionFormat } from "../../shared/version-format";
import { filterUi5Patches } from "../../integrations/ui5-versions/ui5-version-catalog";
import { useUi5VersionCatalog } from "../hooks/useUi5VersionCatalog";

interface VersionComboboxProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
}

const MAX_SUGGESTIONS = 12;

/** Same free-text UI5 version input as VersionInput, plus a quick-filter dropdown of
 * real published versions (from ui5.sap.com) — the target is still a plain string, so
 * typing an unlisted value stays perfectly valid, this just speeds up picking a known
 * one. */
export function VersionCombobox({ value, onChange, label }: VersionComboboxProps) {
  const { state, ensureLoaded } = useUi5VersionCatalog();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);
  const valid = value.length === 0 || isValidVersionFormat(value);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent): void {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const suggestions =
    state.status === "ready" ? filterUi5Patches(state.catalog.patches, value).slice(0, MAX_SUGGESTIONS) : [];

  return (
    <span className="version-combobox" ref={containerRef}>
      {label && <label>{label}</label>}
      <span className="version-input">
        <input
          type="text"
          inputMode="text"
          placeholder="1.136.17"
          value={value}
          aria-invalid={!valid}
          aria-autocomplete="list"
          aria-expanded={open}
          onFocus={() => {
            ensureLoaded();
            setOpen(true);
          }}
          onChange={(event) => {
            onChange(event.target.value);
            setOpen(true);
          }}
          className={valid ? "" : "version-input--invalid"}
        />
        <span className="version-input__hint">
          {valid ? "Format valid — existence not verified." : "Expected format: 1.136.17"}
        </span>
      </span>

      {open && (
        <div className="version-combobox__dropdown" role="listbox">
          {state.status === "loading" && <div className="version-combobox__status">Loading versions…</div>}
          {state.status === "error" && (
            <div className="version-combobox__status version-combobox__status--error">
              Couldn&apos;t load the version list: {state.message}
            </div>
          )}
          {state.status === "ready" && suggestions.length === 0 && (
            <div className="version-combobox__status">No published version matches &quot;{value}&quot;.</div>
          )}
          {state.status === "ready" &&
            suggestions.map((patch) => (
              <button
                type="button"
                key={patch.version}
                className="version-combobox__option"
                role="option"
                aria-selected={patch.version === value}
                onClick={() => {
                  onChange(patch.version);
                  setOpen(false);
                }}
              >
                <span className="version-combobox__option-version">{patch.version}</span>
                <span className="version-combobox__option-eocp">{patch.eocp}</span>
              </button>
            ))}
        </div>
      )}
    </span>
  );
}
