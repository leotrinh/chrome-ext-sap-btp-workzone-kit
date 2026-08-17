/**
 * Vestigial: the floating button used to open this UI as a separate workspace tab,
 * bound to the originating SAP tab via this `?sourceTabId=` query param. That flow was
 * replaced by an in-page overlay (`src/content/workzone-overlay.ts`) that runs inside
 * the SAP tab itself, so nothing sets this param anymore — every caller (docked panel
 * and the overlay iframe alike) now relies on the service worker's "whatever tab is
 * active" fallback, which is correct for both. Kept since the wire protocol still
 * accepts it (see `src/background/service-worker.ts`'s `resolveTargetTabId`).
 */
export function getTargetTabIdFromLocationSearch(search: string): number | undefined {
  const raw = new URLSearchParams(search).get("sourceTabId");
  if (raw === null) {
    return undefined;
  }
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}
