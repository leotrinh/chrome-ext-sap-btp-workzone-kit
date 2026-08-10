import { useCallback, useRef, useState } from "react";
import { fetchUi5VersionCatalog, type Ui5VersionCatalog } from "../../integrations/ui5-versions/ui5-version-catalog";

export type Ui5VersionCatalogState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; catalog: Ui5VersionCatalog }
  | { status: "error"; message: string };

/** Lazily fetches SAP's public UI5 version list on first use, cached for the side
 * panel's lifetime (it doesn't change within a session) so repeated opens of the
 * combobox/modal don't refetch. */
export function useUi5VersionCatalog(): { state: Ui5VersionCatalogState; ensureLoaded: () => void } {
  const [state, setState] = useState<Ui5VersionCatalogState>({ status: "idle" });
  const requestedRef = useRef(false);

  const ensureLoaded = useCallback(() => {
    if (requestedRef.current) {
      return;
    }
    requestedRef.current = true;
    setState({ status: "loading" });
    void fetchUi5VersionCatalog().then((result) => {
      if (result.ok) {
        setState({ status: "ready", catalog: result.catalog });
      } else {
        requestedRef.current = false;
        setState({ status: "error", message: result.error });
      }
    });
  }, []);

  return { state, ensureLoaded };
}
