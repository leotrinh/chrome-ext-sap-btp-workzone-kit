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

- Manifest V3 side panel extension shell (React + TypeScript, Vite).
- Service worker that gates every page operation on HTTPS + a validated SAP BTP Work Zone
  host + a supported admin route before doing anything.
- A packaged MAIN-world page runtime (`window.__BTP_WORKZONE_KIT__`) with a fixed,
  schema-validated command protocol (`PING`, `GET_ENVIRONMENT` implemented; the rest of
  the command set is reserved but not yet implemented).
- Environment detection (subaccount/subdomain) from SAP page metadata, with safe fallback
  handling for malformed metadata.

Not yet implemented: CSRF/GraphQL client, app scanning, UI5 version inspection/update,
bulk mutation, verification, HTML5 refresh, Store packaging assets.

## Security model

- No SAP login is implemented by this extension — you sign in to Work Zone normally.
- No cookies, passwords, or CSRF tokens are read, stored, or exposed to the side panel.
- Chrome permissions are limited to `activeTab`, `scripting`, `storage`, `sidePanel` — no
  host permissions, no `<all_urls>`.
- The side panel never sends a raw URL, GraphQL document, or script to the page — only one
  of a fixed set of command names, validated against a schema before it's used.

## Known limitation

Chrome only (re-)grants `activeTab` when you invoke the extension (click its toolbar
icon) on the currently active tab — it is **not** re-granted just because you switched
tabs while the side panel stayed docked open. If you switch to a different eligible tab
and the panel reports it can't access the tab, click the SAP BTP Workzone Kit toolbar
icon once on that tab, then retry. This is a Chrome/Edge platform behavior, not
something an extension can opt out of without requesting broader host permissions —
which this extension deliberately does not do (see Security model above).

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
4. Click the extension action on a SAP BTP Work Zone admin tab to open the side panel.

## Architecture

React side panel ↔ MV3 service worker (validates the active tab, injects the packaged
runtime) ↔ MAIN-world page runtime (talks to the current SAP session using the signed-in
user's own permissions). See the blueprint's §5 and §9 for the full diagram and runtime
contract.

## Disclaimer

SAP BTP Workzone Kit is an independent browser extension. It is not affiliated with,
endorsed by, sponsored by, or produced by SAP SE.
