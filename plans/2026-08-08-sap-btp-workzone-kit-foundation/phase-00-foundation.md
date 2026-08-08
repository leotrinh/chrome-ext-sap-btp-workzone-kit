# Phase 0 — Foundation

Ref: blueprint §6 (project structure), §7 (manifest), §40 (build stack), §42 Phase 0.

## Requirements

- React + TypeScript (strict) + Vite side panel app.
- MV3 manifest: exactly `activeTab`, `scripting`, `storage`, `sidePanel` permissions; no
  host permissions; no remote code; CSP `script-src 'self'; object-src 'self'`.
- Service worker sets `sidePanel.setPanelBehavior({ openPanelOnActionClick: true })` on
  install.
- Branding: primary `#00c8e8`, secondary `#0B1F33`, accent `#7659FF`.
- Footer: `Made with ❤️ by Leo` (links to buymeacoffee.com/leotrinh) + GitHub link.
- About tab: version, independent-product SAP disclaimer, privacy/security/compatibility
  mentions.
- Tooling scripts runnable: typecheck, lint, test, build, verify:manifest,
  verify:no-remote-code.

## Files to create

```
package.json, tsconfig.json, vite.config.ts, vitest.config.ts, eslint.config.js
public/manifest.json, public/icons/ (placeholder icons)
src/background/service-worker.ts
src/sidepanel/{index.html,main.tsx,App.tsx,app.css}
src/sidepanel/components/{Footer.tsx,AboutPanel.tsx,AppHeader.tsx}
scripts/verify-manifest.mjs
scripts/check-no-remote-code.mjs
scripts/build-extension.mjs
tests/unit/manifest.test.ts
```

## TDD steps

1. Write `tests/unit/manifest.test.ts` asserting: manifest_version 3, permissions array
   equals exactly the 4 allowed values, no `host_permissions` key, CSP has no
   `unsafe-eval`/remote host. Test fails (no manifest yet).
2. Add `public/manifest.json` to make it pass.
3. Write assertions (in the same or a script test) that `scripts/verify-manifest.mjs`
   exits non-zero on a broken manifest fixture and zero on the real one.
4. Implement `verify-manifest.mjs`, `check-no-remote-code.mjs`, `build-extension.mjs`.
5. Scaffold React side panel + service worker; no dedicated unit tests for pure JSX
   (covered by build + manual QA per blueprint §50), but keep components presentational
   and free of business logic so Phase 1+ logic stays testable in `src/domain` /
   `src/integrations`.

## Acceptance criteria

- [x] `pnpm typecheck` passes.
- [x] `pnpm lint` passes.
- [x] `pnpm test` passes (manifest tests green — 54/54 across all Phase 0/1 suites).
- [x] `pnpm build` produces `dist/` with `manifest.json` at root.
- [x] `pnpm verify:manifest` and `pnpm verify:no-remote-code` pass.
- [ ] Manual: `chrome://extensions` → load unpacked `dist/` → action opens side panel.
      **Still not verifiable from this session** — no real Chrome/Edge browser
      available. **The user ran this manually and found the panel blank white.**
      Root cause: the sidepanel build emitted root-absolute asset URLs (`/assets/...`)
      that 404 under `chrome-extension://<id>/sidepanel/`. Fixed by building with
      `base: "./"` in `scripts/build-extension.mjs` (see CHANGELOG.md "Fixed" entry,
      `tests/unit/sidepanel-html.test.ts`). Re-verify with a fresh `pnpm build` + reload
      before considering this criterion done — the automated build-time guard prevents
      the *exact* regression but doesn't replace an actual visual check.

## Deviations from this file's original plan

- Dropped `src/shared/errors.ts` — nothing in Phase 0/1 throws or returns an error shape
  that isn't already covered by `WorkzoneCommandResponse["error"]` (`messaging/protocol.ts`
  / `page-runtime/runtime-types.ts`). Re-add it if/when a later phase (e.g. §27's full
  `AppErrorCode` union) needs a shared error type with real consumers — YAGNI otherwise.

## Risks / rollback

Low risk — greenfield scaffold, nothing to regress. Rollback = delete created files.
