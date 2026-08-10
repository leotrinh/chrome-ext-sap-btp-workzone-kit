# Phase 3 — Scan (List Local Business Apps)

Ref: blueprint §3.5, §12, §51-52.

## Requirements

- `getEntities` query, paginate via `continuationToken` until null; guard against a
  repeated/stuck token (infinite loop protection: cap iterations, detect same token
  twice in a row → abort with `PAGE_CHANGED`-style error).
- Filter `baseId === null` (local apps only, blueprint's explicit V1 scope).
- `getEntity` detail query per app, concurrency-limited to 5 (`APP_DETAIL_CONCURRENCY`).
- One app-detail failure must not abort the whole scan (per-row error state instead).
- New commands: `SCAN_APPS` (returns app summaries, progressive — see below) and
  `GET_APP_VERSION_TARGETS` (per-app detail + UI5 targets, built in Phase 4).

## Files to create

```
src/shared/concurrency.ts (generic concurrency-limited map, reusable)
src/integrations/sap-workzone/graphql/get-entities.ts
src/integrations/sap-workzone/graphql/get-entity.ts
src/integrations/sap-workzone/app-list.ts
src/domain/app-record.ts (WorkzoneAppSummary type)
tests/unit/concurrency.test.ts
tests/unit/app-list.test.ts (pagination loop, baseId filter, stuck-token guard — fetch mocked)
tests/fixtures/graphql/get-entities-page-1.json, get-entities-page-2.json, get-entities-empty.json
```

## TDD steps

1. `concurrency.test.ts` — a generic `mapWithConcurrency(items, limit, fn)` never exceeds
   `limit` in-flight calls (assert via a counter in the mock fn), preserves result order.
2. Implement `concurrency.ts`.
3. `app-list.test.ts` — mock GraphQL responses (fixtures): single page, multi-page,
   empty, `baseId` filtering, repeated-continuation-token abort.
4. Implement `get-entities.ts` (query builder) + `app-list.ts` (pagination loop using
   the Phase 2 GraphQL client).

## Command protocol changes

`SCAN_APPS` payload: none. Response: `{ apps: WorkzoneAppSummary[] }`. This is a
same-tab request/response like `GET_ENVIRONMENT` — the *progressive* UI feel (blueprint
§12 "render summaries, then progressively update rows") is achieved by the UI issuing
`SCAN_APPS` first, then a `GET_APP_VERSION_TARGETS` per app afterward, not by a
streaming protocol — keeps the existing one-shot command/response contract intact.

## Acceptance criteria

- [ ] Pagination loop terminates on `null` continuationToken.
- [ ] Repeated continuation token is detected and aborts safely.
- [ ] `baseId !== null` entries excluded.
- [ ] Detail fetch never exceeds concurrency 5 (asserted in test).
- [ ] One detail failure doesn't stop the rest of the batch.
