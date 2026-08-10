# Phase 5 — Table UX (Search, Sort, Selection, Target Version)

Ref: blueprint §3.8, §14, §15.

## Requirements

- Search: app title OR current-version-badge text contains query (case-insensitive).
- Sort by app name or current version; version sort must be semantic-ish
  (`1.9.0 < 1.10.0 < 1.100.0`), not lexicographic.
- Selection keyed by app **id**, not row index; survives search/sort/re-render.
- Global target-version input + per-row override; format validation
  `^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$` (existence not verified — SAP doesn't expose
  a version-list API we can safely call for this).
- `AppsTable`/`AppRow`/`SearchBox`/`SortMenu`/`VersionInput` React components; selection
  state via a small hook (`useAppSelection`), not prop-drilled raw Sets everywhere.

## Files to create

```
src/domain/search.ts (matchesSearch(app, query))
src/domain/sorting.ts (compareAppTitle, compareUi5Version — semantic split-and-compare)
src/domain/selection.ts (pure Set-based selection helpers)
src/sidepanel/hooks/useAppSelection.ts
src/sidepanel/components/{SearchBox,SortMenu,VersionInput,AppsTable,AppRow}.tsx
tests/unit/search.test.ts
tests/unit/sorting.test.ts
tests/unit/selection.test.ts
```

## TDD steps

1. `sorting.test.ts` — version strings compare correctly including the exact
   `1.9.0 / 1.10.0 / 1.100.0 / 1.136.17` ordering from the blueprint.
2. `search.test.ts` — title match, version-badge match, no-match.
3. `selection.test.ts` — select/deselect/select-all-visible/select-all-loaded/clear,
   survives a filtered view (selecting while filtered doesn't lose hidden selections).
4. Implement pure modules, then wire into components (component wiring not unit tested,
   consistent with the project's established pattern — covered by manual QA).

## Acceptance criteria

- [ ] Version sort matches blueprint's exact example ordering.
- [ ] Selecting under an active search filter never silently selects hidden rows.
- [ ] Invalid target version format blocked before it can reach the planner (Phase 6).
