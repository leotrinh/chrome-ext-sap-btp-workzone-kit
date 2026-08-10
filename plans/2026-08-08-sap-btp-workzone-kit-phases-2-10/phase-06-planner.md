# Phase 6 — Update Planner

Ref: blueprint §16-17.

## Requirements

- `createUi5VersionUpdatePlan(detail, targetVersion)` → `Ui5VersionUpdatePlan`:
  `appId, appTitle, current, targetVersion, changes[], noOp, warnings[]`.
- No-op detection: every writable target already equals `targetVersion` → `noOp: true`,
  `changes: []` — never included in the mutation batch.
- No writable target found → plan carries a warning, `changes: []`, surfaced in the UI
  as "No supported UI5 version target found", not silently dropped.
- Mixed-target normalization: all differing targets get one uniform `targetVersion`,
  each recorded as a separate `Ui5VersionChange`.
- Plan building is **pure** — never mutates the original CDM (`structuredClone` before
  any write), never calls the network.
- Confirmation dialog text must state the exact resulting count (blueprint §17's exact
  template): apps selected / apps changing / already configured / unsupported, target
  version breakdown, final button `Update N Applications`.

## Files to create

```
src/domain/update-plan.ts (Ui5VersionChange, Ui5VersionUpdatePlan types + builder)
src/sidepanel/components/{UpdatePreview,ConfirmDialog}.tsx
tests/unit/update-plan.test.ts
```

## TDD steps

1. `update-plan.test.ts` — one target / multiple targets / no-op / mixed normalization /
   unsupported / invalid target version rejected before plan-building / original CDM
   object identity unchanged (structuredClone proof).
2. Implement `update-plan.ts`.
3. Wire preview + confirm dialog components (manual QA, not unit tested — pure
   presentation over already-tested plan data).

## Acceptance criteria

- [ ] No SAP mutation call anywhere in this phase's code (planner only, Phase 7 mutates).
- [ ] Original `detail.cdm` object is unchanged after planning (reference + deep check).
- [ ] No-op and unsupported apps are excluded from `changes` but visible in the preview
      counts.
