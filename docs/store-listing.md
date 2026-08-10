# Store Listing Draft

Last updated: 2026-08-08. Reflects the actually-implemented permission set
(`storage`, `sidePanel`, one content script scoped to `*.hana.ondemand.com`) — see
`docs/system-architecture.md` for why this differs from the blueprint's original
4-permission spec (`activeTab`/`scripting` were dropped; see that doc's Overview).

## Name

```text
SAP BTP Workzone Kit
```

Fallback (only if Store/trademark review requires it):

```text
BTP Workzone Kit — for SAP BTP Work Zone
```

## Short description

```text
Inspect and safely update supported SAP BTP Work Zone UI5 version settings and trigger HTML5 content refresh.
```

## Long description

```text
SAP BTP Workzone Kit is an independent browser helper for SAP BTP Work Zone
administrators.

FEATURES

• A floating button auto-appears on eligible Work Zone admin pages — no need to pin
  the extension first
• Scan local Work Zone business applications
• Inspect configured sap-ui-version values (target-app and visualization targets)
• Detect mixed/inconsistent configuration instead of silently picking one value
• Search and sort applications
• Set a global target UI5 version, with per-application overrides
• Preview exact changes before writing anything
• Bulk update selected applications sequentially, with a 300ms delay between writes
• Verify configuration after update — mutation success and verification are shown
  as distinct outcomes
• Trigger manual HTML5 content refresh (separate, explicitly confirmed action —
  never auto-triggered after a UI5 update)
• Open the SAPUI5 version overview page
• Works from a docked side panel or a full workspace tab

SECURITY & PRIVACY

• Uses your existing signed-in SAP browser session
• Does not collect SAP passwords
• Does not read or store browser cookies
• Does not store CSRF tokens — they never leave the page context
• No backend, no telemetry, no remote/CDN-loaded code
• Every mutation (UI5 version update, HTML5 refresh) requires explicit confirmation
  showing the exact apps and counts affected before anything is sent to SAP

SAP BTP Workzone Kit is an independent browser extension. It is not affiliated
with, endorsed by, sponsored by, or produced by SAP SE.

Repository:
https://github.com/leotrinh/chrome-ext-sap-btp-workzone-kit

Made with ❤️ by Leo
https://buymeacoffee.com/leotrinh
```

## Single purpose

```text
SAP BTP Workzone Kit's single purpose is to help an authenticated SAP BTP Work Zone
administrator inspect and maintain supported Work Zone application configuration and
trigger the current subaccount's manual HTML5 content refresh through explicit
user-initiated actions.
```

## Permission justification

`storage`:

```text
Stores lightweight interface preferences only (e.g. last-used target UI5 version, sort
order). No SAP tokens, cookies, CDM, tenant data, or GraphQL responses are persisted.
```

`sidePanel`:

```text
Provides the scan, preview, update, HTML5 refresh, and results interface as a docked
panel next to the SAP BTP Work Zone tab.
```

Content script (`*://*.hana.ondemand.com/*`):

```text
Renders a small floating button on eligible SAP BTP Work Zone admin pages so the
extension is reachable without pinning it to the toolbar, and executes the fixed,
schema-validated command set that talks to the current SAP session using the
signed-in user's own permissions. This is the only host-level access the extension
requests — there is no separate `host_permissions` entry and no `<all_urls>` access.
```

## Screenshots / promotional assets

Not yet produced — requires a live SAP BTP Work Zone tenant and cannot be generated
from this repository alone. See `docs/reviewer-instructions.md`.
