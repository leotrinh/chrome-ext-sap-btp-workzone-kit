# Scaffolding Complete: Foundation & Connection Phases (Phases 0–1)

**Date**: 2026-08-08 (session end)  
**Severity**: Medium (structural decisions lock future work)  
**Component**: SAP BTP Workzone Kit Chrome/Edge extension (Manifest V3)  
**Status**: Foundation solid, smoke test outstanding

## What Happened

Scaffolded a full Chrome/Edge Manifest V3 browser extension for SAP BTP Workzone Kit from an empty repository. Implemented Phase 0 (Foundation: React + TypeScript + Vite scaffolding, MV3 safety guardrails) and Phase 1 (Connection: service worker ↔ side panel messaging, host detection, environment metadata extraction) using TDD throughout: tests written first (red), implementation (green), every pure-logic module has a test suite.

All CI checks pass: typecheck, lint, 54 unit tests, build, manifest verification, remote-code detection. Package script produces a valid zip file (manually unzip-verified).

## The Brutal Truth

This was not a small task. The "10-phase blueprint" looks deceptively short in markdown, but scaffolding Phases 0–1 alone required:
- Hand-written zip file logic (no external lib, to stay zero-remote-code)
- Manifest verification automation (because Chrome has no built-in warnings for overpermissioned extensions)
- Windows-specific Vitest path resolution bugs (burned ~1.5 hours chasing truncated import.meta.url paths that worked fine on Linux)
- Dependency version negotiation (React plugin peerDeps didn't match Vite 6, forcing a pin-down)

The honest assessment: **we have a solid foundation, but we haven't touched a real browser yet**. No smoke test. The side panel opens only when the user clicks the toolbar icon on an *active* tab—Chrome's `activeTab` permission re-grants only when the icon is clicked again after a tab switch. This is a platform limitation, not a bug, but it's the kind of sharp edge that bites you in phase 3 when you try to auto-scan a page.

## Technical Details

**Dependency conflict:** `@vitejs/plugin-react@4.x` declares peerDependencies `vite: "^4 || ^5"` but does not include `^6`. Installing vite 6 causes pnpm to fetch *two separate vite copies*—one for the plugin, one for the project—and TypeScript sees conflicting type definitions. Fixed by pinning `vite: ^5.4.11` in lockfile.

**Vitest Windows bug:** Path resolution inside test files via `new URL(relative, import.meta.url)` returned truncated paths (e.g., `D:\tests\fixtures\...` instead of the real nested `D:\DevSpaces\...\tests\fixtures\...`). Workaround: switched test fixture path resolution to `path.resolve(process.cwd(), ...)`, which worked reliably. The bug did not affect native Node.js (e.g., `scripts/package-extension.mjs` ran correctly), only Vitest's transform pipeline.

**Chrome platform limitation:** The `activeTab` permission only persists for the currently active tab in the focused window. When a user switches tabs while the side panel remains open, `tab.url` comes back empty. Fixed by detecting this case and returning `ACTIVE_TAB_NOT_GRANTED` error with an actionable message ("click the icon again on this tab") rather than requesting broad host permissions, which the blueprint forbids.

**Code review findings (subagent):** stale `PRIVACY.md`/`SECURITY.md` links (fixed: created both files), stale-response race in `useWorkzoneEnvironment` (added request-generation counter), missing UTF-8 bit in zip CRC32 header, two components with overly-broad `string` prop types (narrowed to unions).

## What We Tried

1. **vite@6 with @vitejs/plugin-react@4**: Failed (type conflicts, dual vite installs). → Downgraded vite to ^5.4.11.
2. **`import.meta.url` for test fixture paths**: Failed on Windows Vitest (truncated paths). → Switched to `path.resolve()`.
3. **`pnpm ci` for install-from-lockfile**: Failed (invoked pnpm's built-in `ci` subcommand, not the project's script). → Used `pnpm run ci` instead.
4. **Requesting host_permissions to work around activeTab limitation**: Avoided (violates blueprint). → Document the limitation, provide user-friendly error.

## Root Cause Analysis

**Why dependency hell?** The Vite/React plugin ecosystem is still settling at ^6. We could have waited, but the blueprint was written targeting Vite 5 patterns. Forcing Vite 6 would have required rewriting build config and testing assumptions; staying on 5 was lower-risk.

**Why Vitest path bugs?** Vitest transforms TypeScript on Windows differently than Node.js does. The `import.meta.url` API is spec-compliant but Vitest's transpiler was building relative URLs against the *transformed* file location (in a temp directory), not the source location. This was a runtime bug, not a static analysis miss.

**Why no real browser test?** This session ran in a sandboxed environment (no graphical display). Chrome/Edge load-unpacked test requires actual browser UI interaction, which is outside scope. This is acceptable for Phase 1 but **must happen** before Phase 2 (or we'll discover broken assumptions in production).

## Lessons Learned

1. **Test the ecosystem assumptions early.** Dependency version conflicts should be caught on day 1, not when you're halfway through implementation. Running full CI on the skeleton before writing features would have surfaced vite@6 issues immediately.

2. **Platform limitations are not bugs, but they must be documented.** The `activeTab` re-grant behavior is a Chrome design choice, not something we can fix. But we *can* make the user experience clear (e.g., "click the extension icon again on this tab"). Hiding this behind a generic error message is a foot-gun.

3. **Avoid vendor lock-in on path APIs.** Relying on `import.meta.url` worked fine for entry points (which Node processes natively) but broke under Vitest's transformation pipeline. For test fixtures, stick to `path.resolve()` or environment variables until the stack is fully mature.

4. **Zip file writing by hand is tedious but works.** Yes, we could have added `archiver` or `jszip`. But the zero-external-deps choice means the codebase can be audited in 30 seconds. Trade-off: ~200 lines of hand-written ZIP code, but no supply-chain risk. This aligns with the "no remote code" mandate and should be preserved.

5. **Smoke testing in a real browser is non-negotiable.** We have 54 passing tests and a valid zip, but we haven't verified the side panel actually opens, injects scripts correctly, or communicates with the page runtime. Phase 1.5 must include manual browser testing before Phase 2 ships.

## Next Steps

1. **Manual smoke test (critical blocker for Phase 2):** Load extension into Chrome/Edge, click toolbar icon, verify side panel opens, test `PING` and `GET_ENVIRONMENT` messages, confirm no console errors. Estimated 1 hour.
2. **Set up CI for cross-browser testing:** Consider GitHub Actions with chrome-extension-testing or webdriver. Low priority but do this before release.
3. **Document the activeTab limitation:** Add a section to `docs/deployment-guide.md` explaining why users see "Click icon again" error.
4. **Phase 2 prep:** CSRF token extraction and GraphQL client. Update test matrix to cover token expiry, malformed responses, rate-limiting.
5. **Zero-trust audit before Phase 3:** Before we touch UI5 apps or page mutations, have security review the message passing protocol and ZIP packaging.

---

**Owner:** This session (scaffolding complete)  
**Unblocked work:** Phases 2–10 (awaiting smoke test validation)  
**Debt acknowledged:** No git history yet (non-technical choice, not a real issue) and stale docs (fixed mid-session).
