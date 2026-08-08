/**
 * Chrome serves the built side panel from chrome-extension://<id>/sidepanel/index.html,
 * not from the extension's root. A root-absolute asset URL ("/assets/...") resolves to
 * chrome-extension://<id>/assets/... and 404s there (real files live under
 * .../sidepanel/assets/...) — the panel goes blank with no console-visible HTML error.
 *
 * Kept in its own module (no `vite` import) so tests can exercise it without pulling in
 * esbuild, which breaks under some Vitest/jsdom TextEncoder setups.
 * @param {string} html
 * @returns {string[]}
 */
export function findRootAbsoluteAssetRefs(html) {
  const matches = html.match(/(?:src|href)="\/[^/][^"]*"/g) ?? [];
  return matches;
}
