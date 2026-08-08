# System Architecture

Last Updated: 2026-08-08

## Overview

SAP BTP Workzone Kit is a Manifest V3 browser extension for Chrome/Edge with three
runtime layers: a React UI (side panel or workspace tab — same bundle, different host),
a service worker (tab resolution and message relay), and a content script (command
execution, direct access to the SAP page context).

**This architecture was corrected mid-Phase-1** from the blueprint's original §5/§9
design (a MAIN-world runtime injected on demand via `chrome.scripting.executeScript`).
That approach requires `activeTab` granted for the specific tab being injected into,
which Chrome only grants on a toolbar-icon click, a context-menu item, or a keyboard
shortcut — **never** on a click handled by a content script. Since the floating button
(added to let users reach the extension without pinning it) is rendered and clicked
entirely within a content script, the on-demand-injection approach could never actually
get permission for the tab it needed to act on — it failed with "Chrome hasn't granted
this tab access yet" every time, including from the side panel once the workspace tab
itself became the browser's "active tab". See `docs/journals/` for the debugging
history. The fix: declare the runtime as a **static content script** instead (Chrome
auto-injects those without needing `activeTab` at all, since the manifest's
`content_scripts.matches` is itself the permission grant), and relay commands to it via
`chrome.tabs.sendMessage` instead of `chrome.scripting.executeScript`. Same-origin
`fetch()` from an isolated-world content script already carries the page's session
cookies, exactly like a MAIN-world script would — so MAIN-world execution was never
actually required for this extension's needs.

## Runtime Layers

### Layer 1: React UI (side panel or workspace tab)
- **Location:** `src/sidepanel/` — same bundle serves two hosts:
  - Docked side panel (opened via the toolbar icon)
  - A full workspace tab (opened by the floating button, URL carries `?sourceTabId=<id>`
    binding it to the SAP tab it was opened from — see `src/sidepanel/workspace-context.ts`)
- **Role:** User-facing interface (connection status, About panel, future feature controls)
- **Context:** Extension page; cannot access the SAP page's DOM or session directly
- **Permissions:** `chrome.runtime` messaging only (to the service worker)

### Layer 2: Service Worker
- **Location:** `src/background/service-worker.ts`
- **Role:** Resolves which tab id to target, then relays the command to that tab's
  content script. Does **not** read `tab.url` and does **not** perform host/route
  eligibility checks itself — reading a tab's URL requires the same `activeTab`/
  `host_permissions` this extension deliberately doesn't have, so it can't be done here.
- **Tab resolution:**
  - `targetTabId` present (workspace-tab mode): `chrome.tabs.get(targetTabId)` — the
    exact SAP tab the workspace tab was opened from, regardless of which tab is
    currently "active" in the browser (the workspace tab itself usually is, by the time
    a command fires).
  - `targetTabId` absent (side-panel mode): `chrome.tabs.query({active:true})` — correct
    there, since the panel is docked next to the still-active SAP tab.
- **Relay:** `chrome.tabs.sendMessage(tabId, {command, payload})` to the content script
  already running in that tab. No permission needed for this call itself.
- **Workspace tab tracking:** single reusable tab (`chrome.storage.session`, not a
  plain module variable — MV3 service workers are evicted after ~30s idle, which would
  reset in-memory state and cause duplicate tabs), open/focus calls serialized through a
  promise queue to avoid a race spawning two tabs from near-simultaneous clicks.

### Layer 3: Content Script
- **Location:** `src/content/`, built as one bundle: `content-script.js`
  - `floating-button.ts` — renders the ⚡ button (closed Shadow DOM, avoids CSS
    collision with SAP's page styles), re-checks eligibility every 1s (Work Zone's SPA
    routing doesn't reliably fire `hashchange`, matching the source Tampermonkey
    script's proven polling approach)
  - `command-relay.ts` — `chrome.runtime.onMessage` listener: validates the message via
    the same `parseCommandRequest` schema, re-checks `isEligibleWorkzonePage` against
    its own `window.location` (the one place in the extension that *can* read it
    without any permission gate — it's already running in the page), then calls
    `handleCommand()` (`src/page-runtime/command-handler.ts`, reused as-is — only the
    injection mechanism changed, not the command logic)
  - `index.ts` — entry point, wires both up
- **Declared in the manifest** under `content_scripts`, matching
  `*://*.hana.ondemand.com/*`. Auto-injected by Chrome on page load — no `activeTab`, no
  `scripting`, no on-demand injection call needed.
- **Role:** Executes commands with the page's own session (same-origin `fetch()` from
  here carries the page's cookies automatically).

## Command Protocol

The panel and content script communicate via a **fixed, schema-validated command
protocol** (blueprint §8):

- **Allowed commands:** Only literals from `src/messaging/protocol.ts::WORKZONE_COMMANDS`
- **Validation:** Every request validated by the same Zod schema at two points — once
  when it leaves the panel/workspace tab (service worker's `validateIncomingPanelMessage`),
  once when it arrives at the content script (`command-relay.ts`'s own
  `parseCommandRequest` call) — the content script never trusts the service worker
  blindly, even though it's this extension's own code.
- **No dynamic payload:** Panel never sends URLs, GraphQL documents, or scripts — only
  command name + schema-validated data (`targetTabId` is the one extra field, used only
  for tab routing, never interpreted as SAP-facing data)
- **Response format:** All responses follow the `WorkzoneCommandResponse` envelope
  (success or error with code/message)

### Implemented Commands (Phase 1)

| Command | Purpose | Payload | Response |
|---------|---------|---------|----------|
| `PING` | Test runtime availability | None | `{ ok: true, data: { pong: true, runtimeVersion } }` |
| `GET_ENVIRONMENT` | Detect SAP subaccount/subdomain/route | None | `{ ok: true, data: WorkzoneEnvironment }` |

### Reserved Commands (Phases 2+)

- `SCAN_APPS` — Discover local business apps
- `GET_APP_VERSION_TARGETS` — Inspect current UI5 version configuration
- `BUILD_UPDATE_PLAN` — Stage bulk update with preview
- `UPDATE_APP_UI5_VERSION` — Execute mutation
- `VERIFY_APP_UI5_VERSION` — Confirm changes applied
- `REFRESH_HTML5_CONTENT` — Trigger manual provider refresh

## Security Boundaries

### What Crosses the Boundary

- **Panel/workspace tab → Service Worker:** Command name + schema-validated payload +
  optional `targetTabId` (only)
- **Service Worker → Content Script:** Command name + payload (already validated once;
  re-validated again on arrival)
- **Content Script → Service Worker:** Response envelope with success/error result
- **Service Worker → Panel/workspace tab:** Response envelope (verbatim from the content
  script, or a service-worker-level error like `TARGET_TAB_CLOSED`)

### What Never Crosses

- ✗ CSRF tokens, auth cookies, or SAP credentials
- ✗ GraphQL documents or raw SQL
- ✗ Page HTML/DOM content (only structured data extracted by the content script)
- ✗ User session or identity information

### Why This Boundary Matters

1. **No CSRF exposure:** Panel cannot initiate GraphQL mutations; only the content
   script can, with the current SAP session's own auth
2. **No browser-level access to SAP secrets:** Even if the panel is compromised, it
   cannot fabricate credentials or bypass SAP authorization
3. **No dynamic code injection:** Panel cannot request arbitrary scripts be run; only
   known commands are permitted
4. **Audit-friendly:** Every operation logged in the user's browser console with command
   name and result

### A note on `window.postMessage`-style spoofing (considered, not used)

An earlier design for this fix considered keeping a MAIN-world runtime and bridging it
to the content script via `window.postMessage`. That was dropped in favor of running
everything directly in the isolated-world content script (no MAIN world at all), which
sidesteps a real question that design would have raised: a page script (or an XSS on
the SAP page) can observe and potentially forge `postMessage` traffic on the same
origin. With no MAIN-world bridge, there's no such channel to spoof — commands only
ever arrive at the content script via `chrome.tabs.sendMessage` from the extension's own
service worker, which content scripts trust structurally (it isn't reachable from
arbitrary web pages — see `externally_connectable`, which this manifest doesn't declare,
meaning no external page can message this extension at all).

## Data Flow: Example (PING)

```
User clicks "Test Connection" in panel (or the ⚡ button opens the workspace tab, which
auto-fires GET_ENVIRONMENT on load)
         ↓
Panel calls chrome.runtime.sendMessage({ command: "PING", targetTabId? })
         ↓
Service worker receives message
  - Validates schema (command must be in known set, payload must match command's schema)
  - Resolves target tab id (targetTabId via chrome.tabs.get, or active tab via
    chrome.tabs.query) — no URL/eligibility check here, just an id lookup
         ↓
Service worker calls chrome.tabs.sendMessage(tabId, { command: "PING", payload })
  - If no content script answers (not a hana.ondemand.com page, or not loaded yet):
    NOT_SAP_WORKZONE_PAGE error
         ↓
Content script's command-relay receives the message
  - Re-validates the command shape
  - Checks isEligibleWorkzonePage(window.location) — its own page, no permission needed
  - If eligible: calls handleCommand("PING", undefined) → { ok: true, data: {...} }
         ↓
Service worker passes the response back to the panel
  - Panel receives { ok: true, data: {...} }
  - Displays "Connected" status
```

## Environment Detection (Phase 1)

When `GET_ENVIRONMENT` is called on an eligible page:

1. **Primary source:** Hostname prefix (e.g., `tenant.dt.us10.hana.ondemand.com` → `tenant`)
2. **Fallback 1:** SAP metadata in `<meta name="sap.flp.cf.Config">` (JSON)
   - Look for `accountData.subDomain` or `accountData.tenantId`
3. **Fallback 2:** Alternative SAP metadata in `<meta name="sap.ushellConfig.siteConfig">` (JSON)
   - Look for `tenantId` or `identityZoneId`
4. **Safety:** JSON parse errors never throw; each fallback tried independently

## Manifest Permissions

```json
{
  "permissions": ["storage", "sidePanel"],
  "content_scripts": [
    {
      "matches": ["*://*.hana.ondemand.com/*"],
      "js": ["content-script.js"],
      "run_at": "document_idle"
    }
  ]
}
```

- `storage` — Reserved for future per-subaccount settings (e.g., UI5 version defaults);
  not yet used by any Phase 0/1 code
- `sidePanel` — Display the docked side panel UI
- `content_scripts` match on `*.hana.ondemand.com` — the floating button + command
  execution; Chrome match patterns can't express "contains `.dt.`" (only a single
  leading `*.` host wildcard is supported), so the content script re-checks the real
  eligibility rule (`isEligibleWorkzonePage`) itself before acting on anything

**No** `activeTab`, `scripting`, `<all_urls>`, `host_permissions`, or cross-origin fetch
permissions — this is a **smaller** permission footprint than the blueprint's original
4-permission spec, not a larger one, despite the added floating-button feature.

## Testing Strategy

- **Unit tests** (`tests/unit/`) — Command validation, eligibility checks, environment
  extraction, manifest shape/permission constraints, build-output asset-path guard
- **Build verification** — Scripts enforce "no remote code" (all script sources are
  local) and reject overly-broad `content_scripts` match patterns
- **Manual QA** — Load unpacked in real Chrome/Edge to verify the floating button, the
  workspace tab, and the side panel all correctly show live environment data (automation
  cannot access `chrome://` URLs, so this step is currently manual-only)

See `phase-00-foundation.md` / `phase-01-connection.md` acceptance criteria for the full
checklist.

## Future Extensibility

Adding a new command (e.g., Phase 2's `SCAN_APPS`):

1. Add command to `WORKZONE_COMMANDS` array in `src/messaging/protocol.ts`
2. Update `IMPLEMENTED_NO_PAYLOAD_COMMANDS` or add a new payload schema
3. Implement the handler in `src/page-runtime/command-handler.ts` (still the right home
   for command logic — only the *injection mechanism* changed, not this layer)
4. Add a unit test for the new handler (payload validation and error cases)
5. Update this document's "Reserved Commands" section

The schema boundary is rigid by design — future commands follow the same validation
contract, validated once at the service worker and again at the content script.
