# Changelog

## [Unreleased] — targeting 0.2.0

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
