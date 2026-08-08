# Changelog

## [Unreleased]

### Added

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
