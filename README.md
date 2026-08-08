# SAP BTP Workzone Kit

A browser toolkit for inspecting and safely maintaining supported SAP BTP Work Zone
administration configuration.

Repository: https://github.com/leotrinh/chrome-ext-sap-btp-workzone-kit

Made with ❤️ by Leo — https://buymeacoffee.com/leotrinh

> SAP BTP Workzone Kit is an independent browser extension. It is not affiliated with,
> endorsed by, sponsored by, or produced by SAP SE. SAP, SAP BTP, SAPUI5, and SAP Build
> Work Zone are trademarks or registered trademarks of SAP SE or its affiliates.

## Status

This repository currently implements the full blueprint's **Phase 0 (Foundation)** and
**Phase 1 (Connection)** — see
[hand-off/sap-btp-workzone-kit-codex-blueprint.md](hand-off/sap-btp-workzone-kit-codex-blueprint.md)
for the complete product spec and remaining phases (scan, UI5 inspection, update planner,
mutation, verification, HTML5 refresh, Store release).

Implemented so far:

- Manifest V3 side panel extension shell (React + TypeScript, Vite), also reusable as a
  full workspace tab (see "Floating button" below).
- A content script (declared in the manifest, auto-injected on eligible pages — see
  Architecture below) that both renders the floating button and directly handles the
  fixed, schema-validated command protocol (`PING`, `GET_ENVIRONMENT` implemented; the
  rest of the command set is reserved but not yet implemented).
- Environment detection (subaccount/subdomain) from SAP page metadata, with safe fallback
  handling for malformed metadata.
- A small floating button, auto-injected on eligible Work Zone pages, that opens/focuses
  a single reusable workspace tab — no need to pin the extension first.

Not yet implemented: CSRF/GraphQL client, app scanning, UI5 version inspection/update,
bulk mutation, verification, HTML5 refresh, Store packaging assets.

## Security model

- No SAP login is implemented by this extension — you sign in to Work Zone normally.
- No cookies, passwords, or CSRF tokens are read, stored, or exposed to the side panel.
- Chrome permissions are limited to `storage`, `sidePanel` — **no `activeTab`, no
  `scripting`, no `host_permissions`, no `<all_urls>`.** (An earlier iteration of this
  extension used `activeTab` + `chrome.scripting.executeScript` to inject a runtime
  on demand; that approach turned out to require a toolbar-icon click specifically —
  clicking the in-page floating button doesn't count as that gesture, so it could never
  actually get permission. Switching to a declarative content script, which Chrome
  auto-injects without needing `activeTab` at all, both fixed the bug and let two
  permissions be dropped entirely.)
- One narrowly-scoped content script (`content-script.js`) is declared for
  `*://*.hana.ondemand.com/*`. Chrome shows this as a site-access permission at install
  time — this is the only host-level access the extension has, and it's what lets the
  floating button appear automatically and lets commands run without any further
  permission prompt. The script only reads `window.location` (for eligibility) and
  `document.querySelector('meta[...]')` (for environment detection), and makes
  same-origin `fetch()` calls in later phases — it does not read arbitrary page content,
  does not touch SAP's own DOM/UI, and only ever executes one of the fixed, Zod-validated
  `WorkzoneCommand` literals relayed to it by the service worker.
- The side panel/workspace tab never sends a raw URL, GraphQL document, or script to the
  page — only one of a fixed set of command names, validated against a schema before use.

## Floating button

On any eligible Work Zone admin page, a small ⚡ button appears in the bottom-right area
of the page (auto-injected, no need to pin or click the extension icon first). Clicking
it opens — or focuses, if already open — a single reusable workspace tab with the same
UI as the side panel. This mirrors the original Tampermonkey helper's discovery UX.

The side panel (via the toolbar icon) still works too — both are just different entry
points into the same UI, and both relay commands through the same content script.

## Supported Work Zone routes

The extension only activates on `*.dt.*.hana.ondemand.com` tabs whose URL hash contains
one of: `Content-Manage`, `Site-Directory`, `Provider-Manage`, `SubAccount-Settings`,
`Transport-Manager`.

## Development

Requires Node.js and pnpm.

```bash
pnpm install
pnpm dev            # side panel dev server (UI only — outside the extension host,
                     # chrome.* calls fail gracefully instead of being mocked)
pnpm test           # unit tests
pnpm typecheck
pnpm lint
pnpm build           # produces dist/
pnpm verify:manifest
pnpm verify:no-remote-code
pnpm ci              # full chain used in CI
```

### Load unpacked in Chrome/Edge

1. `pnpm build`
2. Open `chrome://extensions` (or `edge://extensions`), enable Developer mode.
3. **Load unpacked** → select the `dist/` folder.
4. Open a SAP BTP Work Zone admin tab (a supported route, see below) — the ⚡ floating
   button should appear automatically; click it to open the workspace tab. Or click the
   extension's toolbar icon to open the side panel instead.

## Architecture

React side panel/workspace tab → MV3 service worker (resolves which tab to target, no
permission needed for that) → `chrome.tabs.sendMessage` → the content script already
running in that tab (declared in the manifest, auto-injected by Chrome, no `activeTab`/
`host_permissions` needed) → executes the command and talks to the current SAP session
using the signed-in user's own cookies (same-origin `fetch()` from a content script
carries them automatically, the same way a page's own script would).

This deviates from the blueprint's §5/§9, which specified a MAIN-world runtime injected
on demand via `chrome.scripting.executeScript`. That approach needs `activeTab` granted
for the specific tab being injected into, which Chrome only grants on a toolbar-icon
click (or context-menu item, or keyboard shortcut) — never on a click handled by a
content script, which is exactly how the floating button works. Isolated-world content
scripts don't have that limitation (Chrome pre-authorizes them via the manifest's
`content_scripts.matches` declaration) and can make the same authenticated same-origin
requests, so there was no actual need for MAIN-world execution here.

## Disclaimer

SAP BTP Workzone Kit is an independent browser extension. It is not affiliated with,
endorsed by, sponsored by, or produced by SAP SE.
