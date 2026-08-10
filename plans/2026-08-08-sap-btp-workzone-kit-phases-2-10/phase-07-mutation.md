# Phase 7 — Mutation (Bulk Update)

Ref: blueprint §3.9, §18-19. **Highest-risk phase — real writes to the user's SAP tenant.**

## Requirements

- `UPDATE_APP_UI5_VERSION` command: takes one `Ui5VersionUpdatePlan`, applies its
  `changes` to a **cloned** CDM, sends the exact `batchProcess` mutation from blueprint
  §18/§52 — do not alter the mutation shape.
- Sequential queue, one plan at a time, `MUTATION_DELAY_MS` (300ms) between calls, never
  `Promise.all`.
- Per-app `AppUpdateStatus`: pending → updating → updated → verifying → verified |
  failed | skipped | unknown (blueprint §19).
- Auth/CSRF failure during the batch **stops the queue** — does not continue to the next
  app silently.
- `changes.length === 0` (no-op plan) is never sent as a mutation — must be filtered out
  before the queue starts (Phase 6 already marks these `noOp: true`).
- This command is the first one that's genuinely destructive — the UI (Phase 6's
  `ConfirmDialog`) is the only thing allowed to trigger it, and only after the exact
  confirmation text has been shown and accepted.

## Files to create

```
src/integrations/sap-workzone/graphql/batch-process.ts
src/integrations/sap-workzone/ui5-version-writer.ts
src/domain/update-result.ts (Ui5VersionUpdateResult, BulkUpdateState, AppUpdateStatus)
src/sidepanel/components/UpdateProgress.tsx
src/sidepanel/hooks/useBulkUpdate.ts (sequential queue orchestration)
tests/unit/batch-process.test.ts (payload shape, cdm cloning, response classification)
tests/unit/bulk-update-queue.test.ts (sequencing/delay/stop-on-auth-failure, using fake timers + mocked writer)
```

## TDD steps

1. `batch-process.test.ts` — mutation variables exactly match blueprint §18 shape given
   a plan's changes; response with GraphQL `errors` is never treated as success; CDM
   passed to the mutation is a clone, original untouched.
2. Implement `batch-process.ts` + `ui5-version-writer.ts` (uses Phase 2's GraphQL
   client).
3. `bulk-update-queue.test.ts` — with a mocked writer function: asserts strict
   sequencing (never 2 in-flight), the 300ms gap (fake timers), and that an
   auth/CSRF-classified failure halts remaining items instead of continuing.
4. Implement `useBulkUpdate.ts` + wire `UpdateProgress.tsx` (manual QA for the visual
   part).

## Acceptance criteria

- [ ] Mutation payload byte-for-byte matches blueprint §18/§52 shape for a representative
      plan.
- [ ] No parallel mutation calls (test asserts max concurrency 1).
- [ ] GraphQL `errors` in a 200 response is never reported as success.
- [ ] Auth/CSRF failure stops the queue; already-completed items keep their status.
- [ ] Cannot be reached without going through Phase 6's confirmation dialog (UI wiring
      check, manual).

## Manual verification required

This phase cannot be tested against a real SAP tenant from this environment. Before
relying on it against production data: run it once against a low-stakes/test app with
`Update 1 Application`, confirm the resulting `sap-ui-version` in Work Zone actually
changed to the expected value, and confirm unrelated CDM fields are byte-identical to
before (diff the CDM before/after outside this tool).
