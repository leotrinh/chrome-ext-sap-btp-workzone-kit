# Phase 8 — Verification

Ref: blueprint §20.

## Requirements

- After a successful mutation: re-fetch app detail (`getEntity`), re-run Phase 4's
  `readUi5VersionTargets`, compare every previously-writable target against the
  expected version.
- `VerificationStatus`: `verified | mismatch | not_verifiable | verification_failed`.
- Mutation success and verification are **distinct** statuses in the UI — never display
  "Verified" for a mutation-only success.

## Files to create

```
src/integrations/sap-workzone/verification.ts (verifyUi5Version)
src/domain/update-result.ts (extend with VerificationStatus — same file as Phase 7)
tests/unit/verification.test.ts
```

## TDD steps

1. `verification.test.ts` — exact match → `verified`; different value → `mismatch`;
   re-fetch network failure → `verification_failed`; no writable target on the
   re-fetched CDM → `not_verifiable`.
2. Implement `verification.ts` using Phase 2's client + Phase 4's reader.
3. Wire into `useBulkUpdate.ts`'s per-app flow (after `updated`, before final status).

## Acceptance criteria

- [ ] Verification only ever runs after a mutation reports success.
- [ ] `verified` requires every target to match, not just one of several.
- [ ] Verification failure never rolls back or retries the mutation itself.
