---
title: SAP BTP Workzone Kit — Phases 2-10 (full feature set)
status: done
priority: P1
effort: large
branch: master
tags: [chrome-extension, mv3, sap-btp-workzone]
created: 2026-08-08
---

# SAP BTP Workzone Kit — Phases 2-10

Source of truth: [hand-off/sap-btp-workzone-kit-codex-blueprint.md](../../hand-off/sap-btp-workzone-kit-codex-blueprint.md)

Builds on the corrected architecture from
[plans/2026-08-08-sap-btp-workzone-kit-foundation/](../2026-08-08-sap-btp-workzone-kit-foundation/):
commands execute in the isolated-world content script (`src/content/command-relay.ts` →
`src/page-runtime/command-handler.ts`), reached via `chrome.tabs.sendMessage` — no
`activeTab`/`scripting` permission, same-origin `fetch()` carries the page's session
cookies directly.

## Status

| Phase | Blueprint ref | Status |
|---|---|---|
| 2 — CSRF + GraphQL client | §3.4, §11 | done |
| 3 — Scan (list apps) | §3.5, §12 | done |
| 4 — UI5 Inspection | §3.7, §13 | done |
| 5 — Table UX (search/sort/select/target) | §3.8, §14, §15 | done |
| 6 — Update Planner | §16 | done |
| 7 — Mutation (bulk update) | §3.9, §18, §19 | done |
| 8 — Verification | §20 | done |
| 9 — HTML5 refresh | §3.10, §21 | done |
| 10 — Store release | §33-38 | done |

All 9 phases implemented with TDD (222/222 tests passing) and code-reviewed;
review findings (infinite render loop, TOCTOU mutation risk, sort-direction bug,
schema gap, dead constant, CSRF-assumption/large-batch doc gaps) fixed — see
`reports/` for the review-fix pass. Full CI chain (typecheck, lint, test, build,
verify:manifest, verify:no-remote-code) green. No real-tenant/real-browser manual
verification performed from this environment — see `docs/compatibility.md`
"Known limitations".

## Ground rules carried forward (non-negotiable, blueprint §48/§58)

- Every mutation requires explicit user confirmation (Preview → Confirm → Execute).
- Mutations run sequentially (300ms delay), never `Promise.all`.
- Original CDM is cloned before mutation; only known `sap-ui-version` paths change.
- No-op plans (already-correct version) are skipped, never re-sent.
- Verification is a distinct step from mutation success — never conflate them.
- Never invent a GraphQL field/mutation not in the blueprint's §52 reference (itself
  taken from the working source userscript, not guessed).
- CSRF token never crosses back to the React UI — stays inside the content script.
- No `console.log` of tokens, CDM, or GraphQL bodies (structured, sanitized logging only).

## Approach

TDD per phase for all pure/testable logic (GraphQL payload building, CDM diffing,
version parsing/sorting, plan construction). Content-script network code
(`fetch`/CSRF/GraphQL calls) is not unit-testable against a real SAP tenant from this
environment — those paths get careful code review + the user's manual verification
against their real tenant, same caveat as the existing "manual load-unpacked QA" item.

## Phase files

- [phase-02-graphql-client.md](phase-02-graphql-client.md)
- [phase-03-scan.md](phase-03-scan.md)
- [phase-04-ui5-inspection.md](phase-04-ui5-inspection.md)
- [phase-05-table-ux.md](phase-05-table-ux.md)
- [phase-06-planner.md](phase-06-planner.md)
- [phase-07-mutation.md](phase-07-mutation.md)
- [phase-08-verification.md](phase-08-verification.md)
- [phase-09-html5-refresh.md](phase-09-html5-refresh.md)
- [phase-10-store-release.md](phase-10-store-release.md)

## Links

- Reports: `reports/`
