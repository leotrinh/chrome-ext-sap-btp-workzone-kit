---
title: SAP BTP Workzone Kit — Foundation (Phase 0 + Phase 1)
status: completed
priority: P1
effort: medium
branch: main
tags: [chrome-extension, mv3, sap-btp-workzone]
created: 2026-08-08
---

# SAP BTP Workzone Kit — Foundation (Phase 0 + Phase 1)

Source of truth: [hand-off/sap-btp-workzone-kit-codex-blueprint.md](../../hand-off/sap-btp-workzone-kit-codex-blueprint.md)

## Status

| Phase | Status | Notes |
|---|---|---|
| Phase 0 — Foundation | done (automated); manual load-unpacked QA still open | See phase-00 §Manual verification |
| Phase 1 — Connection | done | Code-reviewed, no critical/high defects |

## Scope this round

Repo is currently empty (only `.claude/` and `hand-off/`). This plan covers Blueprint §42
Phase 0 (Foundation) and Phase 1 (Connection) only. Phases 2-10 (CSRF/GraphQL, scan, UI5
inspection, planner, mutation, verification, HTML5, Store release) are out of scope this
round — tracked as follow-up phases, not started.

## Approach

TDD per phase (user request): write failing unit tests for the phase's pure logic first,
then implement to green, then run the full verification chain.

## Dependencies

- Node/npm/pnpm available locally (verified).
- No SAP tenant/credentials needed for Phase 0/1 — all Phase 1 tests use synthetic
  hostnames/hashes/metadata fixtures (blueprint §30, never real SAP data).

## Acceptance criteria (from blueprint §42)

**Phase 0:** Chrome/Edge `load unpacked` works; action opens side panel; manifest
permissions are exactly `activeTab, scripting, storage, sidePanel`; no remote code.

**Phase 1:** Valid SAP Work Zone page (`*.dt.*.hana.ondemand.com` + supported hash route)
is detected eligible; malicious/lookalike domains are rejected; malformed metadata JSON
never throws; no CSRF/token is ever returned to the React side (N/A yet — CSRF lands in a
later phase, but the runtime boundary must already be shaped so nothing sensitive crosses
it in Phase 1).

## Phase files

- [phase-00-foundation.md](phase-00-foundation.md)
- [phase-01-connection.md](phase-01-connection.md)

## Links

- Reports: `reports/`
