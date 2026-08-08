# Deployment Guide

Last Updated: 2026-08-08

## Local Development

### Prerequisites

- Node.js 18+ and pnpm (or npm)
- Chrome or Microsoft Edge browser

### Setup

```bash
# Clone the repository
git clone https://github.com/leotrinh/chrome-ext-sap-btp-workzone-kit.git
cd chrome-ext-sap-btp-workzone-kit

# Install dependencies
pnpm install
```

### Development Workflow

#### Run Tests
```bash
pnpm test              # Run all unit tests (Vitest)
```

Expected output: 54+ passing tests (manifest, eligibility, environment, protocol)

#### Type Check
```bash
pnpm typecheck         # TypeScript strict mode check
```

#### Lint
```bash
pnpm lint              # ESLint
```

#### Run Dev Server (UI Preview Only)

```bash
pnpm dev               # Start Vite dev server for side panel
```

**Important:** This runs the React UI in an isolated dev environment—Chrome extension APIs fail gracefully (not mocked). Use this to iterate UI components, styling, and layout. To test the full extension behavior (service worker, page runtime, command protocol), use **Load Unpacked** (see below).

#### Build for Distribution

```bash
pnpm build             # Vite build + verification scripts
```

This produces:
- `dist/manifest.json` (at root, required by Chrome)
- `dist/sidepanel/` (React UI — serves both the docked side panel and the workspace tab)
- `dist/service-worker.js` (background service worker)
- `dist/content-script.js` (floating button + command execution — declared as a
  content script in the manifest, auto-injected by Chrome)

Verification runs automatically:
- `pnpm verify:manifest` — Validates manifest schema and permissions
- `pnpm verify:no-remote-code` — Audits dist/ for external script sources

#### Full Verification Chain (Used in CI)

```bash
pnpm ci                # typecheck → lint → test → build → verify
```

Use this before submitting PRs or preparing releases.

## Load Unpacked in Chrome/Edge

### Steps

1. **Build the extension**
   ```bash
   pnpm build
   ```

2. **Open Extensions Management**
   - **Chrome:** `chrome://extensions`
   - **Edge:** `edge://extensions`

3. **Enable Developer Mode**
   - Toggle "Developer mode" (top-right corner)

4. **Load Unpacked**
   - Click **"Load unpacked"**
   - Select the `dist/` folder from the repo
   - The extension now appears in your extension list with ID and status

5. **Test on a SAP BTP Work Zone Page**
   - Navigate to a SAP BTP Work Zone admin page:
     - Format: `https://<subdomain>.dt.<region>.hana.ondemand.com/#<route>`
     - Example: `https://tenant.dt.us10.hana.ondemand.com/#Content-Manage`
   - Supported routes: `Content-Manage`, `Site-Directory`, `Provider-Manage`, `SubAccount-Settings`, `Transport-Manager`
   - If the URL is eligible, the extension icon becomes clickable

6. **Open Side Panel**
   - Click the extension icon in the toolbar
   - A side panel opens on the right showing the "Connection" tab
   - Click **"Test Connection"** to verify `PING` command works

7. **View Developer Console**
   - Press `F12` or right-click → **Inspect**
   - Open the **Console** tab
   - Commands and their results are logged here

### Troubleshooting Load Unpacked

| Issue | Solution |
|-------|----------|
| **Icon not clickable on Work Zone page** | URL is not eligible (wrong domain or route). Check URL matches `*.dt.*.hana.ondemand.com` and hash contains one of the supported routes. |
| **"No SAP BTP Workzone Kit content script is running on that tab"** | The tab isn't a `hana.ondemand.com` page, or the extension was just reloaded and the page needs a refresh to get the content script re-injected. |
| **Build fails with TypeScript errors** | Run `pnpm typecheck` to see errors; fix and re-run `pnpm build` |
| **Manifest validation fails** | Check `dist/manifest.json` was created; if not, re-run `pnpm build`. |
| **Side panel/workspace tab is blank white, no console error visible** | Historical bug (fixed): the sidepanel build used to emit root-absolute asset URLs (`/assets/...`) that 404 under `chrome-extension://<id>/sidepanel/`. `scripts/build-extension.mjs` now builds with `base: "./"` and throws at build time if a root-absolute reference reappears (see `tests/unit/sidepanel-html.test.ts`). If you see this again, run `pnpm build` fresh and check `dist/sidepanel/index.html`'s `<script src>`/`<link href>` are relative (`./assets/...`). |
| **⚡ floating button doesn't appear on an eligible page** | Reload the extension (`chrome://extensions` → reload icon) after any rebuild — content scripts don't hot-reload. Confirm the URL is genuinely eligible per the rule above; the button re-checks every 1s. |

## Production Deployment

### Pre-Release Checklist

- [ ] All tests passing: `pnpm ci` succeeds
- [ ] Manual QA: Load unpacked works on real SAP BTP tenant
- [ ] No hardcoded credentials or API keys in source
- [ ] `README.md` disclaimer about independent product status visible
- [ ] Version updated in `public/manifest.json` and `package.json`

### Chrome Web Store (Phase 9+)

Currently planned (not yet implemented). See `project-roadmap.md§Phase 9`.

**Future steps:**
1. Create developer account on Chrome Web Store
2. Prepare store assets (screenshots, descriptions, privacy policy)
3. Submit extension for review (may take 1-3 weeks)
4. Address review feedback
5. Publish

### Distribution via Load Unpacked

For development and internal testing:

1. Build: `pnpm build`
2. Package: `zip -r sap-btp-workzone-kit-v1.0.0.zip dist/`
3. Distribute: Share `.zip` file with testers
4. Testers: Unzip, then Chrome → Extensions → Load unpacked → select unzipped folder

## Environment Variables

None currently used (Phase 0-1). Future phases may add:
- `SAP_WORKZONE_DEBUG` — Enable verbose logging (opt-in)
- `SAP_WORKZONE_API_ENDPOINT` — Override GraphQL endpoint (Phase 2+)

No credentials should ever be stored in env vars or source code.

## Debugging

### Browser Console Logs

Commands are logged by the page runtime to the page's console:

```javascript
// Example PING response
PING → { ok: true, data: null }

// Example GET_ENVIRONMENT response
GET_ENVIRONMENT → { ok: true, data: { subaccount: "tenant", subdomain: "tenant" } }

// Example error
PING → { ok: false, error: { code: "NOT_SAP_WORKZONE_PAGE", message: "..." } }
```

### Service Worker Logs

Open Chrome DevTools on the extension itself:

1. Go to `chrome://extensions`
2. Find "SAP BTP Workzone Kit"
3. Click **"Service Worker"** link (or "Inspect views" → "service-worker.js")
4. DevTools opens with service worker context
5. View console for eligibility checks and message handling

### React Side Panel Logs

Open Chrome DevTools on the extension itself:

1. Right-click the extension icon in the toolbar
2. Select **"Inspect"** (or **"Inspect popup"** if available)
3. Console shows React component logs, hook execution, command responses

### Page Runtime Access (from Page Console)

```javascript
// Check if runtime is available
window.__BTP_WORKZONE_KIT__

// Call a command directly (for debugging)
window.__BTP_WORKZONE_KIT__.handle("PING", undefined)
```

## Performance Optimization

### Build Size

Current `dist/` size: ~200-300 KB (uncompressed)

To analyze:
```bash
npm install -g source-map-explorer
source-map-explorer 'dist/*.js'
```

### Lazy Loading (Future)

Phases 2-8 handlers not loaded until needed (defer import until `SCAN_APPS` first called, etc.). Currently all handlers imported in `command-handler.ts` (Phase 1 only has 2 small handlers, so no optimization needed yet).

### Caching Strategy

- Extension storage: Reserve for per-subaccount settings (Phase 2+)
- Page runtime: In-memory caches (environment, CSRF token) expire on page reload
- App list cache: 10 min TTL recommended (Phase 3+)

## Rollback Procedure

If a build fails to work:

1. Revert the problematic commit: `git reset --hard <previous-commit>`
2. Rebuild: `pnpm build`
3. Reload unpacked extension: Go to `chrome://extensions` → Find "SAP BTP Workzone Kit" → **"Reload"** button
4. Test again

## CI/CD Integration

The repository includes a **blueprint** for CI/CD pipelines. Currently no automated pipeline exists; manual workflow:

1. Developer commits to feature branch
2. Developer runs `pnpm ci` locally (full verification chain)
3. Developer opens PR
4. Code review + approval
5. Merge to `main`
6. Manual build + test on staging SAP tenant
7. Tag release: `git tag v1.0.0`
8. Push tag (future: trigger Chrome Web Store submission)

## Supported Browsers & Versions

| Browser | Minimum Version | Manifest Version | Notes |
|---------|-----------------|------------------|-------|
| Chrome | 102+ | V3 | Primary target |
| Microsoft Edge | 102+ | V3 | Chromium-based, same MV3 support |
| Firefox | N/A | Not supported | Uses WebExtensions API (incompatible with MV3) |

## Known Limitations

None currently around tab access — the extension no longer relies on `activeTab` at
all (an earlier iteration did, and hit exactly this kind of permission gap; see
`docs/system-architecture.md`'s "Overview" section for the full story of why that was
replaced with a declarative content script instead).

Remaining limitation: the extension reloads (`chrome://extensions` → reload icon) don't
hot-reload already-open tabs' content scripts — a page opened before a reload needs a
manual refresh to pick up the new content script.

### No Background Mutation

Phase 0-1 (and all future phases) only execute commands **when the user explicitly requests them**. No background polling, background mutations, or auto-refresh. This is by design to avoid:
- Surprise config changes while admin isn't watching
- CSRF token refreshes eating rate limits
- Unnecessary load on SAP infrastructure

## Support & Feedback

- **Bug reports:** GitHub Issues
- **Feature requests:** GitHub Discussions
- **Security issues:** Contact author privately (see README.md)
- **Donations/Support:** https://buymeacoffee.com/leotrinh

## Next Steps

To implement Phase 2 (CSRF & GraphQL client):

1. Read `project-roadmap.md§Phase 2`
2. See `hand-off/sap-btp-workzone-kit-codex-blueprint.md§3.4` (CSRF details) and `§3.5` (GraphQL query structure)
3. Add CSRF retrieval to page runtime
4. Build GraphQL query builder utility
5. Add `SCAN_APPS` command handler
6. Write tests for new handlers
7. Rebuild: `pnpm build` and test on real SAP tenant
