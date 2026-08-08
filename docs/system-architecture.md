# System Architecture

Last Updated: 2026-08-08

## Overview

SAP BTP Workzone Kit is a Manifest V3 browser extension for Chrome/Edge with three isolated runtime layers: a React side panel (extension UI), a service worker (page validation and command relay), and a packaged MAIN-world page runtime (direct access to SAP page context).

## Runtime Layers

### Layer 1: React Side Panel
- **Location:** `src/sidepanel/`
- **Role:** User-facing interface (connection status, About panel, future feature controls)
- **Context:** Extension isolated world; cannot access page DOM or SAP session directly
- **Permissions:** chrome.runtime messaging only (to service worker)

### Layer 2: Service Worker
- **Location:** `src/background/service-worker.ts`
- **Role:** Gatekeeper; validates every command against eligibility rules before delegating to page runtime
- **Eligibility checks:**
  - HTTPS protocol required
  - Hostname matches `*.dt.*.hana.ondemand.com` pattern (exact suffix, not substring tricks)
  - URL hash contains one of: `Content-Manage`, `Site-Directory`, `Provider-Manage`, `SubAccount-Settings`, `Transport-Manager`
  - `activeTab` permission granted (re-granted only when user invokes extension on that tab)
- **Behavior:** If tab is not eligible, returns error instead of attempting injection
- **Error handling:** Distinguishes `ACTIVE_TAB_NOT_GRANTED` (user must click icon on tab) from `NOT_SAP_WORKZONE_PAGE` (wrong domain/route)

### Layer 3: Page Runtime (MAIN World)
- **Location:** `src/page-runtime/`, injected as `page-runtime.js`
- **Role:** Executes commands in MAIN world context with access to SAP's window and DOM
- **Injection:** Service worker injects `page-runtime.js` into `MAIN` world via `chrome.scripting.executeScript`
- **Entry point:** `window.__BTP_WORKZONE_KIT__` exposes async `handle(command, payload)` method
- **Availability:** Only exists on eligible pages; idempotent (safe to re-inject)

## Command Protocol

The panel and page runtime communicate via a **fixed, schema-validated command protocol** (blueprint §8):

- **Allowed commands:** Only literals from `src/messaging/protocol.ts::WORKZONE_COMMANDS`
- **Validation:** All panel requests validated by Zod schema before relay
- **No dynamic payload:** Panel never sends URLs, GraphQL documents, or scripts—only command name + schema-validated data
- **Response format:** All responses follow `WorkzoneCommandResponse` envelope (success or error with code/message)

### Implemented Commands (Phase 1)

| Command | Purpose | Payload | Response |
|---------|---------|---------|----------|
| `PING` | Test runtime availability | None | `{ ok: true, data: null }` |
| `GET_ENVIRONMENT` | Detect SAP subaccount/subdomain | None | `{ ok: true, data: { subaccount, subdomain } }` |

### Reserved Commands (Phases 2+)

- `SCAN_APPS` — Discover local business apps
- `GET_APP_VERSION_TARGETS` — Inspect current UI5 version configuration
- `BUILD_UPDATE_PLAN` — Stage bulk update with preview
- `UPDATE_APP_UI5_VERSION` — Execute mutation
- `VERIFY_APP_UI5_VERSION` — Confirm changes applied
- `REFRESH_HTML5_CONTENT` — Trigger manual provider refresh

## Security Boundaries

### What Crosses the Boundary

- **Panel → Service Worker:** Command name + schema-validated payload (only)
- **Service Worker → Page Runtime:** Command name + payload (already validated)
- **Page Runtime → Service Worker:** Response envelope with success/error result
- **Service Worker → Panel:** Response envelope (verbatim from page runtime, or service worker error)

### What Never Crosses

- ✗ CSRF tokens, auth cookies, or SAP credentials
- ✗ GraphQL documents or raw SQL
- ✗ Page HTML/DOM content (only structured data extracted by page runtime)
- ✗ User session or identity information

### Why This Boundary Matters

1. **No CSRF exposure:** Panel cannot initiate GraphQL mutations; only page runtime can, with current SAP session's own auth
2. **No browser-level access to SAP secrets:** Even if panel is compromised, it cannot fabricate credentials or bypass SAP authorization
3. **No dynamic code injection:** Panel cannot request arbitrary scripts be run; only known commands are permitted
4. **Audit-friendly:** Every operation logged in user's browser console with command name and result

## Data Flow: Example (PING)

```
User clicks "Test Connection" in panel
         ↓
Panel calls chrome.runtime.sendMessage({ command: "PING" })
         ↓
Service worker receives message
  - Validates schema (command must be in known set, payload must match command's schema)
  - Checks active tab eligibility (HTTPS + SAP host + supported route)
  - If not eligible → return error
         ↓
Service worker calls `runCommandOnActiveTab("PING", undefined)`
  - Injects page-runtime.js into tab (MAIN world)
  - Calls window.__BTP_WORKZONE_KIT__.handle("PING", undefined)
         ↓
Page runtime returns { ok: true, data: null }
         ↓
Service worker passes response to panel
  - Panel receives { ok: true, data: null }
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

Result structure:
```typescript
{
  ok: true,
  data: {
    subaccount: string,      // e.g., "tenant"
    subdomain: string,       // e.g., "tenant"
  }
}
```

## Manifest Permissions

Exactly four permissions (blueprint §7):

```json
{
  "permissions": ["activeTab", "scripting", "storage", "sidePanel"],
  "host_permissions": []
}
```

- `activeTab` — Only grant tab URL/DOM access when user explicitly invokes extension
- `scripting` — Inject and execute page runtime
- `storage` — Reserve for future per-subaccount settings (e.g., UI5 version defaults)
- `sidePanel` — Display side panel UI

**No** `<all_urls>`, `host_permissions`, or cross-origin fetch permissions.

## Testing Strategy

- **Unit tests** (`tests/unit/`) — Command validation, eligibility checks, environment extraction
- **Manifest tests** — Validate manifest.json schema and permission constraints (no host_permissions, no unsafe CSP)
- **Build verification** — Scripts enforce "no remote code" (all script sources are local)
- **Manual QA** — Load unpacked in real Chrome/Edge to verify panel UI and tab eligibility gates (automation cannot access `chrome://` URLs)

See `phase-00-foundation.md` acceptance criteria for full checklist.

## Future Extensibility

Adding a new command (e.g., Phase 2's `SCAN_APPS`):

1. Add command to `WORKZONE_COMMANDS` array in `src/messaging/protocol.ts`
2. Update `IMPLEMENTED_NO_PAYLOAD_COMMANDS` or add new payload schema
3. Implement handler in `src/page-runtime/command-handler.ts`
4. Add unit test for new handler (test payload validation and error cases)
5. Update this document's "Reserved Commands" section

The schema boundary is rigid by design — future commands follow the same validation contract.
