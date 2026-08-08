/**
 * When the floating button opens this UI as a workspace tab, the service worker binds
 * it to the originating SAP tab via a `?sourceTabId=` query param (see
 * `openOrFocusWorkspaceTab` in the service worker). Absent when running as the docked
 * side panel — there, the service worker falls back to "whatever tab is active",
 * which is correct for panel mode since the panel isn't itself a tab.
 */
export function getTargetTabIdFromLocationSearch(search: string): number | undefined {
  const raw = new URLSearchParams(search).get("sourceTabId");
  if (raw === null) {
    return undefined;
  }
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}
