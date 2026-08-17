# Compatibility

Last updated: 2026-08-10.

| Field | Value |
|---|---|
| Extension version | 0.3.0 (see `package.json`/`public/manifest.json`) |
| Adapter/blueprint compatibility | Matches `hand-off/sap-btp-workzone-kit-codex-blueprint.md` §52's GraphQL reference and the source Tampermonkey userscript's proven request shapes |
| Last manual test against a real tenant | Partial: real DevTools evidence (running the reference Tampermonkey script alone against a live tenant) was used to find and fix the actual CSRF pre-flight bug, but the fix itself has not yet been retested end-to-end — see "Known limitations" |
| Chrome version tested | Not yet verified in a real browser (sandboxed dev environment can't load `chrome://extensions`) |
| Edge version tested | Not yet verified |
| Observed Work Zone route variants | Only the five documented in the blueprint (`Content-Manage`, `Site-Directory`, `Provider-Manage`, `SubAccount-Settings`, `Transport-Manager`) — no others have been observed or tested |

## Supported CDM paths

Exactly the two paths from blueprint §3.7/§18, both read and write:

- `payload.targetAppConfig["sap.integration"].urlTemplateParams.query["sap-ui-version"]`
- `payload.visualizations[key].vizConfig["sap.flp"].target.parameters["sap-ui-version"].value`

Any other location a UI5 version might theoretically be configured is not detected or
touched.

## GraphQL operations used

- `getEntities` — list local business apps (blueprint §3.5/§52)
- `getEntity` — fetch one app's CDM (blueprint §3.6/§52)
- `batchProcess` — apply a UI5 version update (blueprint §3.9/§18/§52)
- `POST /semantic/entity/provider/html5` (REST, not GraphQL) — manual HTML5 content refresh (blueprint §3.10/§21)

These are internal SAP UI contracts, not a documented public API — see
`docs/system-architecture.md` and blueprint §4.4/§45 for what to do if SAP changes
this behavior.

## Known limitations

- **CSRF pre-flight fix not yet retested end-to-end against a real tenant.** Root
  cause (confirmed by running the real Tampermonkey reference script *alone*,
  extension disabled, against a real tenant, and comparing its DevTools capture
  byte-for-byte): `HEAD /semantic/graphql` returns HTTP 400, but the response STILL
  carries a valid, usable `x-csrf-token` header — the exact token the reference
  script's very next request succeeds with. The reference script's `getCsrfToken()`
  never checks `res.ok`/status at all; it just reads the header unconditionally. This
  extension's `fetchCsrfToken()` used to check the status *first*
  (`classifyHttpResponseError()`), discarding a token that was right there any time
  the status wasn't 2xx. Two intermediate method changes (`GET`, then `POST` with a
  trivial query) were tried and discarded before this was found — neither was the
  actual fix. Fixed by reverting to `HEAD` (matching the reference script exactly)
  and reading the header unconditionally, before any status check
  (`src/integrations/sap-workzone/csrf.ts`).

  A MAIN-world fetch bridge (`src/content/main-world-bridge.ts` +
  `src/content/fetch-bridge.ts`, see `docs/system-architecture.md`'s "Layer 4") was
  added earlier in this investigation, on the hypothesis that execution context was
  the cause — that hypothesis was disproven by the same real-tenant evidence above
  (the reference script, a genuine page script, hit the identical HTTP 400). The
  bridge is kept since it's still a correct fetch-transport improvement, just not what
  fixed this symptom; it may be worth simplifying away later if nothing else depends
  on it. None of this has been retested end-to-end against a real tenant yet.
- **The real `getEntities` query SAP's own launchpad shell uses is richer** than what
  this extension (and the Tampermonkey reference) currently send — observed fields
  include `description`, `providerId`, `lastModified`, `flpType`, `visualizations`,
  `defaultViz`, `totalItems`, and `queryData.sortBy`/`orderBy`. GraphQL servers
  generally don't reject a query for requesting fewer fields, so this isn't believed to
  be the cause of the HTTP 400 above, but `src/integrations/sap-workzone/graphql/get-entities.ts`
  should be revisited to match this richer, confirmed-working shape once the fetch
  bridge is confirmed to resolve the current blocker.
- **No manual browser verification performed yet.** Every phase's business logic has
  automated test coverage (`pnpm test`), but the actual "does this work against a
  real, authenticated SAP BTP Work Zone tenant" question has not been answered from
  this session — no real browser or real tenant was available. Before relying on
  this in production: load unpacked in a real Chrome/Edge profile, sign in to a real
  (ideally non-production) Work Zone tenant, and manually walk through scan → inspect
  → update one low-stakes app → verify → HTML5 refresh, per
  `docs/deployment-guide.md`'s manual QA checklist and blueprint §50.
- **Mutation phase (Phase 7) and HTML5 refresh (Phase 9) are the highest-risk,
  least-verified code paths** — they write to the user's real SAP tenant. Test
  against a single low-stakes app first.
- No pagination stress-test against a tenant with hundreds/thousands of business
  apps — the `MAX_PAGES` defensive cap (200 pages × 50 = 10,000 apps) has not been
  exercised against real data.
- **CSRF token sharing between endpoints is an unverified assumption.** The HTML5
  refresh call (`src/integrations/sap-workzone/html5-refresh.ts`) reuses the same
  cached CSRF token the GraphQL client acquires from `GET /semantic/graphql`
  (`acquireCsrfToken` in `graphql-client.ts`), on the assumption that the token is
  session-scoped rather than endpoint-scoped. This is a common SAP/OData convention
  but has not been confirmed against a real Work Zone tenant. If wrong, HTML5 refresh
  would fail with a CSRF error on every attempt, including after the built-in
  retry-with-a-fresh-token path (since the "fresh" token would come from the same
  GraphQL endpoint). If this is observed, the fix is to fetch a separate CSRF token
  scoped to the HTML5 endpoint instead of sharing the cache.
- **Large scans (many apps) send one `GET_APP_VERSION_TARGETS` message per full
  batch**, not chunked. `useAppScan.ts` calls this once with every scanned app id;
  the content script processes them at concurrency 5
  (`APP_DETAIL_CONCURRENCY`) but as one long-lived `chrome.tabs.sendMessage` /
  `chrome.runtime.sendMessage` round trip with no timeout or retry on either side.
  Real Chrome's message-passing and MV3 service-worker lifecycle behavior under a
  long-running one-shot callback (e.g. a tenant with 100+ local apps) has not been
  tested. If this proves flaky in practice, chunk the request client-side (e.g.
  batches of 20-30 app ids) instead of sending the whole list at once.
