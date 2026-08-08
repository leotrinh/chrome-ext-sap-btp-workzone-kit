# Codebase Summary

Last Updated: 2026-08-08

## Project Status

**Phases Implemented:** 0 (Foundation) + 1 (Connection)  
**Total Blueprint Phases:** 10 (Phase 2-10 reserved/not started)  
**Build Status:** Automated in CI; manual QA on load-unpacked pending

## File-by-File Breakdown

### Configuration & Build

| File | Purpose | Status |
|------|---------|--------|
| `package.json` | Dependencies (React 19, TypeScript, Vite, Zod, Vitest) | ✓ Implemented |
| `tsconfig.json` | TypeScript strict mode enabled | ✓ Implemented |
| `vite.config.ts` | Build config for side panel + page runtime | ✓ Implemented |
| `vitest.config.ts` | Unit test runner config | ✓ Implemented |
| `eslint.config.js` | Linting rules (TypeScript, React 19) | ✓ Implemented |

### Manifest & Public Assets

| File | Purpose | Status |
|------|---------|--------|
| `public/manifest.json` | MV3 manifest (activeTab, scripting, storage, sidePanel only) | ✓ Implemented |
| `public/icons/` | Placeholder extension icons (16x16, 48x48, 128x128) | ✓ Implemented |

### Backend (Service Worker & Page Runtime)

#### Service Worker
| File | Purpose | Status |
|------|---------|--------|
| `src/background/service-worker.ts` | Main extension logic: page eligibility check, command relay, permission gating | ✓ Phase 1 |

**Key functions:**
- `checkActiveTab()` — Validates HTTPS + SAP host + supported route hash
- `injectPageRuntime()` — Loads `page-runtime.js` into MAIN world
- `runCommandOnActiveTab()` — Orchestrates message flow from panel → service worker → page runtime
- Error handling: Distinguishes `ACTIVE_TAB_NOT_GRANTED` vs. `NOT_SAP_WORKZONE_PAGE`

#### Page Runtime
| File | Purpose | Status |
|------|---------|--------|
| `src/page-runtime/index.ts` | Creates `window.__BTP_WORKZONE_KIT__` singleton runtime object | ✓ Phase 1 |
| `src/page-runtime/command-handler.ts` | Dispatches commands to their handlers | ✓ Phase 1 (PING, GET_ENVIRONMENT implemented) |
| `src/page-runtime/runtime-types.ts` | TypeScript types for runtime and responses | ✓ Phase 1 |

**Key exports:**
- `WorkzoneRuntime` — Interface for `window.__BTP_WORKZONE_KIT__`
- `WorkzoneCommandResponse` — Union of success/error response types

### Messaging & Validation

| File | Purpose | Status |
|------|---------|--------|
| `src/messaging/protocol.ts` | Fixed command set (8 total: 2 implemented, 6 reserved) | ✓ Phase 1 |
| `src/messaging/validation.ts` | Zod schema validation for panel-to-service-worker messages | ✓ Phase 1 |

**Commands:**
- **Implemented:** `PING`, `GET_ENVIRONMENT`
- **Reserved (Phase 2+):** `SCAN_APPS`, `GET_APP_VERSION_TARGETS`, `BUILD_UPDATE_PLAN`, `UPDATE_APP_UI5_VERSION`, `VERIFY_APP_UI5_VERSION`, `REFRESH_HTML5_CONTENT`

### SAP Integration

| File | Purpose | Status |
|------|---------|--------|
| `src/integrations/sap-workzone/eligibility.ts` | URL eligibility checks (HTTPS, `.dt.*.hana.ondemand.com`, supported hash) | ✓ Phase 1 |
| `src/integrations/sap-workzone/constants.ts` | Hardcoded lists: valid route segments, GraphQL endpoints (future use), etc. | ✓ Phase 1 |
| `src/integrations/sap-workzone/environment.ts` | Environment detection (subaccount/subdomain from hostname or SAP metadata) | ✓ Phase 1 |
| `src/integrations/sap-workzone/types.ts` | TypeScript types for environment and SAP data shapes | ✓ Phase 1 |

**Eligibility rules:**
- Hostname: Must end in `.hana.ondemand.com` and include `.dt.` (rejects look-alike domains)
- Protocol: HTTPS only
- Route: URL hash must contain one of: `Content-Manage`, `Site-Directory`, `Provider-Manage`, `SubAccount-Settings`, `Transport-Manager`

### React Side Panel

| File | Purpose | Status |
|------|---------|--------|
| `src/sidepanel/index.html` | Side panel DOM shell (single `<div id="root">`) | ✓ Phase 0 |
| `src/sidepanel/main.tsx` | React bootstrap (ReactDOM.render to #root) | ✓ Phase 0 |
| `src/sidepanel/App.tsx` | Main panel component (layout, tab routing) | ✓ Phase 1 |
| `src/sidepanel/app.css` | Branding colors, layout, responsive design | ✓ Phase 1 |

**Components:**
- `AppHeader.tsx` — Title + logo
- `ConnectionCard.tsx` — Connection status, PING test, environment display
- `AboutPanel.tsx` — Version info, product disclaimer, privacy/security notices
- `Footer.tsx` — "Made with ❤️ by Leo" + GitHub link

**Hooks:**
- `useWorkzoneCommand()` — Send command to service worker, handle response
- `useWorkzoneEnvironment()` — Query environment and cache result

### Tests

| File | Purpose | Status |
|------|---------|--------|
| `tests/unit/manifest.test.ts` | Verify manifest schema, permissions, CSP | ✓ Phase 0 |
| `tests/unit/eligibility.test.ts` | Test SAP host/route detection (eligible + rejected URLs) | ✓ Phase 1 |
| `tests/unit/environment.test.ts` | Test environment extraction (hostname + fallback metadata) | ✓ Phase 1 |
| `tests/unit/protocol.test.ts` | Test command validation and known command set | ✓ Phase 1 |

**Coverage:** 54 passing tests (Phase 0/1 combined)

### Build & Verification Scripts

| File | Purpose | Status |
|------|---------|--------|
| `scripts/verify-manifest.mjs` | Validate manifest.json constraints (no host_permissions, CSP safe) | ✓ Phase 0 |
| `scripts/check-no-remote-code.mjs` | Scan dist/ for external script sources (security audit) | ✓ Phase 0 |
| `scripts/build-extension.mjs` | Custom build step (executed post-Vite, pre-package) | ✓ Phase 0 |

## What's NOT Built Yet

### Phase 2: CSRF & GraphQL Client
- No `/semantic/graphql` integration
- No CSRF token retrieval or refresh logic
- No GraphQL query builders or batch process mutation

### Phase 3: App Scanning
- No `entities()` GraphQL query (list business apps)
- No continuation-token pagination
- No app filtering or sorting UI

### Phase 4: UI5 Version Inspection
- No app-detail loading
- No UI5 version extraction from CDM paths
- No version target detection (targetAppConfig vs. visualization)

### Phases 5-10: Update Planner, Mutation, Verification, HTML5 Refresh, Store Release
- No bulk update planning UI
- No batchProcess mutation
- No verification suite
- No HTML5 provider refresh
- No Chrome Web Store assets or submission

## Dependencies (Partial List)

| Package | Role | Version |
|---------|------|---------|
| React | UI framework | 19.x |
| TypeScript | Type system | 5.x |
| Vite | Build tool | 6.x |
| Vitest | Unit test runner | 2.x |
| Zod | Schema validation | 3.x |
| ESLint | Code quality | 9.x |

Run `pnpm install` to see full list.

## Build Artifacts

| Directory | Purpose |
|-----------|---------|
| `dist/` | Build output (manifest.json at root, side panel + page runtime bundles) |
| `mta_archives/` | Reserved for future Chrome Web Store packaging |

## Development Workflow

```bash
pnpm install              # Install dependencies
pnpm dev                  # Start side panel dev server (outside extension host)
pnpm test                 # Run unit tests (Vitest)
pnpm typecheck           # TypeScript strict check
pnpm lint                # ESLint
pnpm build               # Build for distribution (Vite + custom scripts)
pnpm verify:manifest     # Validate manifest constraints
pnpm verify:no-remote-code  # Audit for external scripts
pnpm ci                  # Full verification chain (used in CI)
```

## File Structure

```
chrome-ext-sap-btp-workzone-kit/
├── public/
│   ├── manifest.json
│   └── icons/
├── src/
│   ├── background/
│   │   └── service-worker.ts
│   ├── page-runtime/
│   │   ├── index.ts
│   │   ├── command-handler.ts
│   │   └── runtime-types.ts
│   ├── messaging/
│   │   ├── protocol.ts
│   │   └── validation.ts
│   ├── integrations/sap-workzone/
│   │   ├── eligibility.ts
│   │   ├── environment.ts
│   │   ├── constants.ts
│   │   └── types.ts
│   └── sidepanel/
│       ├── App.tsx
│       ├── app.css
│       ├── components/
│       ├── hooks/
│       ├── index.html
│       ├── main.tsx
│       └── ...
├── tests/unit/
│   ├── manifest.test.ts
│   ├── eligibility.test.ts
│   ├── environment.test.ts
│   └── protocol.test.ts
├── scripts/
│   ├── verify-manifest.mjs
│   ├── check-no-remote-code.mjs
│   └── build-extension.mjs
├── package.json
├── vite.config.ts
├── vitest.config.ts
├── eslint.config.js
├── tsconfig.json
├── pnpm-lock.yaml
└── dist/                 (generated on `pnpm build`)
```
