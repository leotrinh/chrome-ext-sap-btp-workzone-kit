import { useEffect, useMemo, useState } from "react";
import { filterUi5Patches, groupPatchesByMinor } from "../../integrations/ui5-versions/ui5-version-catalog";
import { useUi5VersionCatalog } from "../hooks/useUi5VersionCatalog";

interface Ui5VersionOverviewModalProps {
  onSelect: (version: string) => void;
  onClose: () => void;
}

/** Full browsable/searchable SAPUI5 version list (ui5.sap.com/versionoverview.json),
 * grouped by minor version like SAP's own overview page. Clicking any patch selects it
 * and closes the modal. */
export function Ui5VersionOverviewModal({ onSelect, onClose }: Ui5VersionOverviewModalProps) {
  const { state, ensureLoaded } = useUi5VersionCatalog();
  const [query, setQuery] = useState("");

  useEffect(() => {
    ensureLoaded();
  }, [ensureLoaded]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const groups = useMemo(() => {
    if (state.status !== "ready") {
      return [];
    }
    return groupPatchesByMinor(filterUi5Patches(state.catalog.patches, query));
  }, [state, query]);

  return (
    <div className="confirm-dialog__backdrop" role="presentation" onClick={onClose}>
      <div
        className="ui5-version-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ui5-version-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="ui5-version-modal__header">
          <h2 id="ui5-version-modal-title">Available SAPUI5 Versions</h2>
          <input
            type="search"
            className="search-box"
            placeholder="Search version…"
            aria-label="Search UI5 versions"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            autoFocus
          />
          <button type="button" className="btn btn--ghost btn--sm" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="ui5-version-modal__body">
          {state.status === "loading" && <p className="placeholder-note">Loading versions…</p>}
          {state.status === "error" && (
            <p className="apps-panel__error">Couldn&apos;t load the version list: {state.message}</p>
          )}
          {state.status === "ready" && groups.length === 0 && (
            <p className="placeholder-note">No versions match &quot;{query}&quot;.</p>
          )}
          {state.status === "ready" && groups.length > 0 && (
            <table className="ui5-version-modal__table">
              <thead>
                <tr>
                  <th>Version</th>
                  <th>Patches</th>
                  <th>End of Cloud Provisioning</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((group) => (
                  <tr key={group.minorVersion}>
                    <td className="ui5-version-modal__minor">{group.minorVersion}</td>
                    <td>
                      <div className="ui5-version-modal__patches">
                        {group.patches.map((patch) => (
                          <button
                            type="button"
                            key={patch.version}
                            className="ui5-version-modal__patch"
                            onClick={() => onSelect(patch.version)}
                          >
                            {patch.version}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td>
                      <div className="ui5-version-modal__eocp-list">
                        {group.patches.map((patch) => (
                          <span key={patch.version} className="ui5-version-modal__eocp">
                            {patch.eocp}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
