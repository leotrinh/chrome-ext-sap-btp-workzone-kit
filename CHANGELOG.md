# Changelog

## [0.2.1] — 2026-08-11

### Fixed

- After a bulk UI5 version update finished, nothing visible confirmed it: `UpdateProgress`
  (`src/sidepanel/components/UpdateProgress.tsx`) rendered as a plain block appended
  after `<AppsTable>` in the normal document flow — unlike `ConfirmDialog`/
  `Ui5VersionOverviewModal`, it had no fixed-position backdrop. Against a real tenant
  scan with many rows, the table pushed the result panel below the side panel's visible
  viewport, so a successful (or failed) update looked like it produced no message at
  all. Fixed by rendering it as a fixed-position overlay reusing the existing
  `.confirm-dialog__backdrop` pattern (`src/sidepanel/app.css`), always visible
  regardless of table size; closes on Escape/backdrop-click once the queue isn't
  running.
- The apps table kept showing the pre-update "Current UI5" version after a successful
  update — only a manual "Scan Applications" click refreshed it, because
  `confirmUpdate()` in `src/sidepanel/components/AppsPanel.tsx` never re-triggered
  `scan()` after `bulkUpdate.run()` finished. Fixed by auto re-scanning once when the
  bulk update's state transitions to `"completed"`.

## [0.2.0] — 2026-08-10

### Added — automated GitHub Release on merge to main

- `.github/workflows/ci.yml` gained a `release` job that runs after `ci` succeeds,
  only for a push to `main` (the repo's default branch — previously `master`,
  renamed). It downloads the extension zip `ci` already built and packaged, then
  creates (or updates, if one already exists for the current `package.json` version)
  a GitHub Release tagged `v<version>` with that zip attached — via the `gh` CLI and
  the workflow's own `GITHUB_TOKEN`, no third-party release action. See
  `docs/deployment-guide.md`'s "CI/CD Integration" section. Verified working:
  `v0.2.0` published automatically on the first real merge.

### Added — UI redesign + UI5 version picker

- Full visual redesign of the side panel: design-token-based color system, distinct
  button variants by action risk/track (`btn--primary/secondary/warning/danger/accent/
  ghost`), status pills, refined cards/header/tabs/table (`src/sidepanel/app.css` and
  across `src/sidepanel/components/`). No behavior change — purely visual/markup.
- "Target UI5 Version" is now a quick-filter combobox
  (`src/sidepanel/components/VersionCombobox.tsx`) backed by SAP's public version list
  (`https://ui5.sap.com/versionoverview.json`, `src/integrations/ui5-versions/ui5-version-catalog.ts`) —
  typing filters real published versions inline; the field still accepts any free-text
  value (existence is never enforced).
- New "Version Overview" modal (`src/sidepanel/components/Ui5VersionOverviewModal.tsx`)
  showing every published SAPUI5 version grouped by minor version with End-of-Cloud-
  Provisioning dates (mirrors ui5.sap.com's own overview page), with search — clicking
  a patch sets it as the target version. Fetched lazily, cached for the panel's
  lifetime, `credentials: "omit"` (no SAP session data ever sent to this third-party
  host — see `PRIVACY.md` §6). No manifest/permission changes needed: extension pages
  can fetch cross-origin subject to CORS, and ui5.sap.com allows it.

### Added (Phases 2-9 — full feature set per the hand-off blueprint)

- CSRF acquisition + fixed same-origin GraphQL client with cached-token reuse and a
  single retry on CSRF rejection (`src/integrations/sap-workzone/{csrf,graphql-client,response-classifier}.ts`).
- App scanning: paginated `getEntities` (local-apps-only filter, stuck-token guard),
  concurrency-5-limited `getEntity` detail fetch
  (`src/integrations/sap-workzone/{app-list,app-detail}.ts`, `src/shared/concurrency.ts`).
  Wired to `SCAN_APPS`/`GET_APP_VERSION_TARGETS`.
- UI5 version inspection detecting every supported target (not just the first found),
  with `none`/`single`/`consistent`/`mixed` classification
  (`src/integrations/sap-workzone/ui5-version-reader.ts`).
- Table UX: search, semantic version sort, id-keyed selection surviving filters, global
  + per-row target version input (`src/domain/{search,sorting,selection}.ts`,
  `src/sidepanel/components/{SearchBox,SortMenu,VersionInput,AppsTable,AppRow}.tsx`).
- Update planner: pure diff builder (no-op/mixed-normalization/unsupported detection),
  confirmation-dialog summary counts (`src/domain/update-plan.ts`,
  `src/sidepanel/components/{UpdatePreview,ConfirmDialog}.tsx`).
- Bulk mutation: `batchProcess` GraphQL call against a cloned CDM, sequential queue with
  a 300ms delay and stop-on-auth/CSRF-failure semantics
  (`src/integrations/sap-workzone/ui5-version-writer.ts`,
  `src/sidepanel/hooks/useBulkUpdate.ts`).
- Post-mutation verification, tracked as a status distinct from mutation success
  (`src/integrations/sap-workzone/verification.ts`).
- HTML5 content refresh as an explicitly-confirmed, separate action — never
  auto-triggered after a UI5 update (`src/integrations/sap-workzone/html5-refresh.ts`,
  `src/sidepanel/components/Html5RefreshCard.tsx`).
- GitHub Actions CI (`.github/workflows/ci.yml`) and Store-release docs
  (`docs/store-listing.md`, `docs/reviewer-instructions.md`, `docs/compatibility.md`).

### Added (Phase 0/1 — foundation)

- Project foundation: Manifest V3 side panel extension (React + TypeScript + Vite),
  service worker, branding, footer/About tab, build/lint/test/verify tooling.
- SAP BTP Work Zone host + admin-route eligibility validation
  (`src/integrations/sap-workzone/eligibility.ts`).
- Environment extraction from SAP page metadata with safe malformed-JSON handling
  (`src/integrations/sap-workzone/environment.ts`).
- Fixed, schema-validated command protocol between the side panel and the packaged
  MAIN-world page runtime (`PING`, `GET_ENVIRONMENT` implemented).
- Floating ⚡ button, auto-injected on eligible Work Zone pages via a content script
  scoped to `*.hana.ondemand.com`, that opens/focuses a single reusable workspace tab
  (`src/content/floating-button.ts`, `src/background/service-worker.ts`).

### Fixed

- Side panel loaded blank in a real unpacked extension: the production build emitted
  root-absolute asset URLs (`/assets/...`) that 404 under
  `chrome-extension://<id>/sidepanel/`. Fixed by building the side panel with a relative
  `base`; added a build-time guard plus a regression test
  (`tests/unit/sidepanel-html.test.ts`) so this can't silently reappear.
- Workspace tab (opened from the floating button) always reported "Active tab is not an
  eligible SAP BTP Work Zone admin page": the service worker resolved commands against
  "whichever tab is currently active", which — once the workspace tab itself became the
  active tab — was the extension's own tab, not the originating SAP tab. Fixed by
  binding the workspace tab to its source SAP tab (`sender.tab.id`, captured when the
  floating button's `OPEN_WORKSPACE_TAB` message arrives) via a `?sourceTabId=` URL
  param, threaded through the message protocol as `targetTabId` and resolved with
  `chrome.tabs.get()` instead of `chrome.tabs.query({active:true})` whenever present.
- Workspace-tab tracking could duplicate the tab or "forget" it entirely: the tracked
  tab id lived in a plain module variable, which (a) isn't safe against concurrent
  `OPEN_WORKSPACE_TAB` calls racing `chrome.tabs.create()` before the id is assigned,
  and (b) doesn't survive MV3 service-worker eviction (~30s idle), which resets module
  state and would spawn a duplicate tab on the next click. Fixed by persisting the
  tracked id in `chrome.storage.session` and serializing concurrent open/focus calls
  through a queue.
- **Architecture correction:** every command (from both the side panel and the
  workspace tab) failed with "Chrome hasn't granted this tab access yet", including
  when invoked from the toolbar icon. Root cause: the runtime was injected on demand
  via `chrome.scripting.executeScript`, gated on `activeTab` — which Chrome only grants
  on a toolbar-icon click, context-menu item, or keyboard shortcut, never on a click
  handled by a content script (the floating button), and which the side-panel flow also
  never reliably got in practice. Fixed by replacing on-demand MAIN-world injection with
  a declarative content script (`src/content/command-relay.ts`, merged into the same
  bundle as the floating button) reached via `chrome.tabs.sendMessage` instead of
  `executeScript`. Same-origin `fetch()` from an isolated-world content script already
  carries the page's session cookies, so MAIN-world execution was never actually
  required. Net result: `activeTab` and `scripting` permissions are no longer declared
  at all — a smaller permission footprint than before, not a larger one. Deleted
  `src/page-runtime/index.ts` (the old MAIN-world bootstrap); `command-handler.ts`'s
  command logic is unchanged, just called directly from the content script now.
- Scan Applications failed against a real tenant with an opaque "SAP returned HTTP
  400.", hiding the actual cause: `postGraphQl()` in
  `src/integrations/sap-workzone/graphql-client.ts` classified any non-2xx HTTP status
  as an immediate, fatal `HTTP_ERROR` and discarded the response body before ever
  parsing it. SAP's `/semantic/graphql` endpoint can attach a non-2xx HTTP status to an
  ordinary GraphQL-level error response — the proven-working reference userscript
  (`hand-off/update-ui-version-script.js`) never gates on HTTP status for GraphQL calls
  at all; it unconditionally parses the JSON body and only inspects `errors`. Fixed by
  only treating redirect/401 (`AUTHENTICATION_REQUIRED`) and real 403
  (`AUTHORIZATION_DENIED`) as fail-fast structural errors; any other non-2xx status now
  still gets its body parsed for a GraphQL error first, falling back to the generic
  `HTTP_ERROR` only when the body isn't a parseable GraphQL error. Applies to every
  GraphQL call (`getEntities`/`getEntity`/`batchProcess`) since they all route through
  this one function.
- The above fix didn't resolve it: `HEAD /semantic/graphql` (CSRF acquisition) kept
  returning HTTP 400 with an empty body against a real tenant, even though the request
  was byte-for-byte identical (URL, method, headers, credentials mode) to the proven
  Tampermonkey reference script's successful request. The only remaining,
  non-JS-controllable difference was the JS execution realm: the reference script runs
  as a genuine page script (MAIN world); this extension's fetch() ran from the
  isolated-world content script. Fixed by adding a declarative MAIN-world content
  script (`src/content/main-world-bridge.ts`, `public/manifest.json`'s second
  `content_scripts` entry with `"world": "MAIN"` — no new permissions required) that
  performs the actual `fetch()` calls in the page's own execution context, reached via
  `window.postMessage` from the isolated world (`src/content/fetch-bridge.ts`'s
  `bridgedFetch()`), which is Chrome's own documented pattern for MAIN/ISOLATED world
  bridging. `csrf.ts`, `graphql-client.ts`, and `html5-refresh.ts` now call
  `bridgedFetch()` instead of the global `fetch()`.
- The MAIN-world change above didn't resolve it either: `HEAD /semantic/graphql` was
  confirmed (via DevTools, against a real tenant) to return HTTP 400 for every caller,
  including the reference Tampermonkey script itself running as a genuine page
  script — ruling out execution context as the cause. Meanwhile, the tenant's real
  `POST /semantic/graphql` (`getEntities`) calls succeeded fine. This points at the
  gateway/router in front of this endpoint not supporting `HEAD` on this route at all
  (rejecting it before request reaches the CSRF handshake logic), rather than anything
  about the request's origin. Fixed by switching the CSRF pre-flight fetch
  (`src/integrations/sap-workzone/csrf.ts`) from `HEAD` to `GET`, same
  `x-csrf-token: Fetch` header and endpoint — the same CSRF convention, a method more
  likely to be proxied correctly.
- The GET fix above also didn't work: it got past the gateway (unlike HEAD) but was
  rejected by the GraphQL server itself with `{"errors":[{"message":"Invalid
  request","extensions":{"code":"BAD_REQUEST"}}]}` — a bodyless GET carries no query
  for the server to parse. Fixed by switching the CSRF pre-flight to `POST` with a
  trivial, universally-valid query (`{ __typename }`) — the same transport every other
  GraphQL call this extension makes (`getEntities`/`getEntity`/`batchProcess`) already
  uses successfully, same `x-csrf-token: Fetch` handshake header. Only the response's
  `x-csrf-token` header is read; the query result itself is discarded.
- **Actual root cause, found by running the real Tampermonkey reference script alone
  (extension disabled) against a real tenant and comparing its DevTools capture
  byte-for-byte:** the reference script's `getCsrfToken()` calls
  `res.headers.get('x-csrf-token')` completely unconditionally — it never checks
  `res.ok` or the response status at all. The real capture showed `HEAD
  /semantic/graphql` returning HTTP 400, but the response STILL carried a valid,
  usable `x-csrf-token` header — the exact token the very next request succeeded
  with. This extension's `fetchCsrfToken()` called `classifyHttpResponseError()`
  *before* ever reading the header, discarding a token that was right there any time
  the status wasn't 2xx. None of the HEAD/GET/POST method changes above were the
  actual fix (though the GET/POST attempts are why this got caught — SAP's response
  shape for a non-2xx status turned out to matter less than just not gating on status
  at all). Fixed by reverting to `HEAD` (matching the reference script exactly, no
  method change needed) and reading `x-csrf-token` from the response unconditionally,
  before any status check — status is now only consulted when no usable token is
  present in the header. Treats `Fetch`/`Required` (SAP's own sentinel values, not
  real tokens) as "no usable token".
