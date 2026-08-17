# System Architecture

Last Updated: 2026-08-17

## Overview

SAP BTP Workzone Kit is a Manifest V3 browser extension for Chrome/Edge with four
runtime layers: a React UI (docked side panel or an in-page full-screen overlay iframe
— same bundle, different host), a service worker (tab resolution and message relay), an
isolated-world content script (command execution, direct access to the SAP page
context), and a MAIN-world content script (a narrow fetch bridge — see "Layer 4"
below).

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

### Layer 1: React UI (side panel or in-page overlay)
- **Location:** `src/sidepanel/` — same bundle serves two hosts:
  - Docked side panel (opened via the toolbar icon)
  - An in-page full-screen overlay (opened by the floating button — see
    `src/content/workzone-overlay.ts`): a closed-Shadow-DOM backdrop rendered on the SAP
    page itself, containing an `<iframe src="chrome-extension://<id>/sidepanel/index.html">`.
    Created lazily on first open, then only hidden/shown on later toggles — the iframe's
    JS execution context (and whatever React state it holds, e.g. an in-progress scan)
    survives across close/reopen.
  - Neither host needs `?sourceTabId=`/`src/sidepanel/workspace-context.ts`'s
    query-param binding any more — the docked panel never did, and the overlay iframe
    now runs *inside* the SAP tab it targets, so "whatever tab is active" is already
    correct without it (see Layer 2 below). That mechanism predates the overlay: it used
    to bind a *separate* workspace tab back to the SAP tab that opened it. It's left in
    the wire protocol as vestigial (no current caller sets it) rather than removed,
    since narrowing it touches ~30 unrelated protocol tests for no behavior change.
- **Role:** User-facing interface (connection status, About panel, apps table, etc.)
- **Context:** Extension page; cannot access the SAP page's DOM or session directly
- **Permissions:** `chrome.runtime` messaging only (to the service worker)

### Layer 2: Service Worker
- **Location:** `src/background/service-worker.ts`
- **Role:** Resolves which tab id to target, then relays the command to that tab's
  content script. Does **not** read `tab.url` and does **not** perform host/route
  eligibility checks itself — reading a tab's URL requires the same `activeTab`/
  `host_permissions` this extension deliberately doesn't have, so it can't be done here.
- **Tab resolution:** `chrome.tabs.query({active:true, currentWindow:true})` — both
  current callers (docked panel, overlay iframe) omit `targetTabId`, so this fallback is
  always what resolves the target tab. The explicit-`targetTabId` branch
  (`chrome.tabs.get(targetTabId)`) is unreachable in practice today; see the docstring
  on `resolveTargetTabId` for why it's still there.

### Layer 3: Content Script
- **Location:** `src/content/`, built as one bundle: `content-script.js`
  - `floating-button.ts` — renders the ⚡ button (closed Shadow DOM, avoids CSS
    collision with SAP's page styles), re-checks eligibility every 1s (Work Zone's SPA
    routing doesn't reliably fire `hashchange`, matching the source Tampermonkey
    script's proven polling approach). Click toggles the overlay open/closed. Never
    tears down the host while the overlay is open — an underlying route change (e.g. the
    browser's own Back button) while an update is running inside the iframe must not
    silently kill it; teardown is retried on the next 1s poll once the overlay is closed.
  - `workzone-overlay.ts` — builds the overlay's backdrop/panel/iframe and its
    close affordances (✕ button, backdrop click, Escape — registered on the capture
    phase and calling `stopPropagation()`, since this listener lives directly on the
    real SAP page's `window`, unlike the sidepanel's own in-iframe dialogs).
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

### Layer 4: MAIN-World Fetch Bridge

- **Location:** `src/content/main-world-bridge.ts`, built as `main-world-bridge.js`.
- **Declared in the manifest** as a second `content_scripts` entry, same
  `*://*.hana.ondemand.com/*` match, with `"world": "MAIN"`. Declarative MAIN-world
  content scripts (Chrome 111+) are auto-injected exactly like an isolated-world one —
  no `activeTab`/`scripting` permission needed for this either.
- **Why it exists:** every `fetch()` this extension makes to SAP (`/semantic/graphql`
  for CSRF/GraphQL, `/semantic/entity/provider/html5` for HTML5 refresh) was originally
  issued from the isolated-world content script (Layer 3). Against a real tenant, the
  CSRF acquisition call (`HEAD /semantic/graphql`) reliably returned HTTP 400 with an
  empty body from the isolated world, while a byte-for-byte identical request (same URL,
  method, headers, credentials mode) issued by a genuine page script (the proven
  Tampermonkey reference this extension is based on) succeeded. The only remaining,
  non-JS-controllable difference was the JS execution realm. Moving the actual `fetch()`
  call into a MAIN-world script reproduces the reference script's execution context
  exactly.
- **How it's reached:** `src/content/fetch-bridge.ts`'s `bridgedFetch()`, called from
  Layer 3 (`csrf.ts`, `graphql-client.ts`, `html5-refresh.ts`) instead of the global
  `fetch()`. Sends a `window.postMessage` request (`src/content/fetch-bridge-protocol.ts`
  defines the message shape), the MAIN-world bridge performs the real `fetch()` and
  posts back a serialized `{status, redirected, headers, bodyText}` result, matched by a
  per-call `requestId`. `bridgedFetch()` wraps that result in a `BridgedResponse` object
  shaped like a real `Response` (`status`/`redirected`/`headers.get()`/`text()`/`json()`/
  `clone()`), so the existing response-classification and body-parsing code in Layer 3
  is unchanged.
- **Scope, deliberately narrow:** this bridge does exactly one thing — relay a fetch
  request/response pair. It does not receive commands, does not touch `chrome.*` APIs
  (MAIN-world scripts can't; that's still Layer 3's job), and never sees CSRF tokens or
  CDM beyond what's already flowing through Layer 3's own network calls.

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

- **Panel/overlay iframe → Service Worker:** Command name + schema-validated payload +
  optional `targetTabId` (only)
- **Service Worker → Content Script:** Command name + payload (already validated once;
  re-validated again on arrival)
- **Content Script → Service Worker:** Response envelope with success/error result
- **Service Worker → Panel/overlay iframe:** Response envelope (verbatim from the
  content script, or a service-worker-level error like `TARGET_TAB_CLOSED`)

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

### A note on `web_accessible_resources` (the overlay iframe)

Embedding `sidepanel/index.html` in an iframe from the Work Zone page requires listing
it under `web_accessible_resources`, scoped to `*://*.hana.ondemand.com/*` — the same
match-pattern limitation noted for `content_scripts` above (Chrome can't express
"contains `.dt.`", only a single leading `*.` host wildcard). This is a genuine widening
of the trust boundary versus the tab-based flow it replaced: before, no web page could
reference `chrome-extension://<id>/sidepanel/index.html` at all; now, *any* origin
matching that wildcard can `<iframe>` it, not only pages that are actually eligible
Work Zone admin routes. This is an accepted trade-off, not an oversight — the exposure
is bounded to display/UI-embedding, not command execution: `command-relay.ts`
independently re-validates `isEligibleWorkzonePage` against the real page the iframe's
own commands would actually run against before executing anything, so an ineligible
embedding origin gains no ability to run `UPDATE_APP_UI5_VERSION` or any other command
that couldn't already run from that origin's own script context.

### A note on `window.postMessage` spoofing (Layer 4's fetch bridge)

Layer 4 exists specifically because an isolated-world `fetch()` behaved differently
than a genuine page-script `fetch()` against a real tenant (see "Layer 4" above), and
`window.postMessage` is Chrome's own documented pattern for bridging MAIN and ISOLATED
worlds — there is no `chrome.*` messaging API reachable from MAIN world. This
necessarily opens a channel a page script (or an XSS on the SAP page) could observe or
forge: it could reply to a `bridgedFetch()` request with a fabricated
`{status, headers, bodyText}` instead of letting the real MAIN-world bridge answer,
feeding fake data into this extension's isolated-world code.

This is deliberately accepted, not overlooked, for one reason: a page script capable of
forging this channel already has arbitrary JS execution in the user's authenticated SAP
session — it could call the real `/semantic/graphql`/`/semantic/entity/provider/html5`
endpoints directly with the user's own cookies, with or without this extension's
involvement. Spoofing the fetch bridge doesn't grant a capability the attacker didn't
already have; it can only feed misleading data into this extension's UI, not exfiltrate
anything the extension has (CSRF tokens/CDM/session data never leave the content script
in either world) or reach the extension from a context that couldn't already reach SAP.
The bridge does add basic hygiene against unrelated `message` event noise: it only
accepts events where `event.source === window` and `event.origin === window.location.origin`
before touching `event.data`, and matches responses to requests by a
per-call `crypto.randomUUID()` (`requestId`) so a stray/replayed message can't be
mistaken for the answer to a real in-flight call. Commands from the panel/workspace tab
are unaffected by any of this — those still only ever arrive at the content script via
`chrome.tabs.sendMessage` from the extension's own service worker (see "What Never
Crosses" above), which is a separate, unrelated channel this fetch bridge doesn't
touch.

## Data Flow: Example (PING)

```
User clicks "Test Connection" in panel (or the ⚡ button opens the in-page overlay,
which auto-fires GET_ENVIRONMENT on load)
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
    },
    {
      "matches": ["*://*.hana.ondemand.com/*"],
      "js": ["main-world-bridge.js"],
      "run_at": "document_start",
      "world": "MAIN"
    }
  ],
  "web_accessible_resources": [
    {
      "resources": ["sidepanel/index.html", "sidepanel/assets/*"],
      "matches": ["*://*.hana.ondemand.com/*"]
    }
  ]
}
```

- `storage` — Reserved for future per-subaccount settings (e.g., UI5 version defaults);
  not yet used by any Phase 0/1 code
- `sidePanel` — Display the docked side panel UI
- `content_scripts[0]` (isolated world) match on `*.hana.ondemand.com` — the floating
  button + command execution; Chrome match patterns can't express "contains `.dt.`"
  (only a single leading `*.` host wildcard is supported), so the content script
  re-checks the real eligibility rule (`isEligibleWorkzonePage`) itself before acting on
  anything
- `content_scripts[1]` (`"world": "MAIN"`) — the fetch bridge (Layer 4 above); same
  match pattern, declared statically so it needs no extra permission either
- `web_accessible_resources` — lets a `*.hana.ondemand.com` page load
  `sidepanel/index.html` in an iframe (the floating button's overlay). Same match-pattern
  caveat as above, plus the trade-off it implies for command execution — see "A note on
  `web_accessible_resources`" under Security Boundaries.

**No** `activeTab`, `scripting`, `<all_urls>`, `host_permissions`, or cross-origin fetch
permissions — this is a **smaller** permission footprint than the blueprint's original
4-permission spec, not a larger one, despite the added floating-button feature and the
MAIN-world fetch bridge.

## Testing Strategy

- **Unit tests** (`tests/unit/`) — Command validation, eligibility checks, environment
  extraction, manifest shape/permission constraints, build-output asset-path guard
- **Build verification** — Scripts enforce "no remote code" (all script sources are
  local) and reject overly-broad `content_scripts` match patterns
- **Manual QA** — Load unpacked in real Chrome/Edge to verify the floating button's
  in-page overlay and the docked side panel both correctly show live environment data
  (automation cannot access `chrome://` URLs, so this step is currently manual-only)

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
