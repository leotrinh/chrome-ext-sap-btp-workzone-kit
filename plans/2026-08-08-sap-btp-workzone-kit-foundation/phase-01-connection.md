# Phase 1 — Connection

Ref: blueprint §3.2 (eligible pages), §3.3 (environment extraction), §4.3 (host
validation), §8 (service worker command protocol), §9 (MAIN-world runtime), §42 Phase 1.

## Requirements

- `isSapWorkzoneHost(hostname)`: true only for `*.dt.*.hana.ondemand.com` (case
  insensitive, trailing-dot tolerant); false for lookalikes
  (`hana.ondemand.com.attacker.example`, `fakehana.ondemand.com`,
  `sap.dt.hana.ondemand.com.evil.test`) and for `http:` protocol.
- `VALID_WORKZONE_HASH_SEGMENTS` route check against `Content-Manage`, `Site-Directory`,
  `Provider-Manage`, `SubAccount-Settings`, `Transport-Manager`.
- Environment extraction: subdomain from hostname, then
  `meta[name="sap.flp.cf.Config"]` / `meta[name="sap.ushellConfig.siteConfig"]`, prefer
  `accountData.tenantId`/`accountData.subDomain`, fallback `tenantId`/`identityZoneId`;
  malformed JSON must not throw.
- MAIN-world runtime bootstrap is idempotent (`window.__BTP_WORKZONE_KIT__`), exposes a
  fixed `handle(command, payload)` command protocol; only fixed `WorkzoneCommand` string
  literals are accepted (no arbitrary command/URL/script from the panel side).
- Service worker validates: active tab HTTPS, valid Work Zone host, valid route, before
  injecting the packaged MAIN-world runtime.

## Files to create

```
src/integrations/sap-workzone/eligibility.ts   (host + route validation)
src/integrations/sap-workzone/environment.ts   (metadata extraction)
src/integrations/sap-workzone/types.ts
src/messaging/protocol.ts                      (WorkzoneCommand union + Zod schemas)
src/messaging/validation.ts
src/page-runtime/runtime-types.ts
src/page-runtime/index.ts                      (bootstrap + handle())
src/page-runtime/command-handler.ts
src/background/service-worker.ts               (extend: tab validation + injection)
tests/unit/eligibility.test.ts
tests/unit/environment.test.ts
tests/unit/protocol.test.ts
tests/fixtures/workzone-pages/*.json           (synthetic metadata fixtures, §30)
```

## TDD steps

1. `tests/unit/eligibility.test.ts` — table-driven cases from blueprint §31 "Host" and
   "Routes" sections (valid, uppercase, trailing dot, no `.dt.`, malicious suffix, HTTP,
   unrelated domain; all 5 routes + unsupported hash). Red first.
2. Implement `eligibility.ts` to green.
3. `tests/unit/environment.test.ts` — both metadata selectors, all fallback fields,
   malformed JSON (must return safe "not found" result, never throw). Red first.
4. Implement `environment.ts` to green.
5. `tests/unit/protocol.test.ts` — command payload validation accepts only known
   `WorkzoneCommand` values and rejects arbitrary strings/URLs/scripts. Red first.
6. Implement `protocol.ts` + `runtime-types.ts` + minimal `page-runtime/index.ts`
   (`PING`, `GET_ENVIRONMENT` only — later phases add the rest).

## Acceptance criteria

- [x] All Phase 1 unit tests pass (host, route, environment, protocol — 49 tests across
      eligibility/environment/protocol/no-remote-code suites).
- [x] Malformed metadata never throws (asserted in tests; independently re-verified by
      the code-reviewer subagent beyond the tested fixture set).
- [x] No token/secret concept exists yet in Phase 1 code (CSRF arrives in Phase 2) — panel
      never touches page-runtime internals directly, only through the typed protocol.
- [x] `pnpm run ci` chain (typecheck/lint/test/build/verify:manifest/
      verify:no-remote-code) passes.

## Code review (2026-08-08)

`code-reviewer` subagent found no critical or high-severity defects in the implemented
code. One high-severity finding was a Chrome platform limitation (not a code bug):
`activeTab` is only (re-)granted to a docked side panel when the user clicks the
toolbar icon on the active tab — switching tabs alone does not re-grant it. Addressed
by distinguishing this case in `service-worker.ts` (`ACTIVE_TAB_NOT_GRANTED` error with
an actionable message) rather than requesting broader host permissions, which the
blueprint explicitly disallows. Medium/low findings (dead `PRIVACY.md`/`SECURITY.md`
links, a stale-response race in `useWorkzoneEnvironment`, a missing UTF-8 flag in the
hand-rolled zip writer, two loosely-typed props) were all fixed same-session; see git
history for this phase's commits.

## Risks / rollback

Low risk. Depends on Phase 0 tooling being in place. Rollback = revert this phase's files;
Phase 0 scaffold stays intact.
