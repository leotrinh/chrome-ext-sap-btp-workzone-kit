# Phase 9 — HTML5 Content Refresh

Ref: blueprint §3.10, §21. Second (and last) genuinely destructive phase.

## Requirements

- `REFRESH_HTML5_CONTENT` command: `POST /semantic/entity/provider/html5` with
  `{providerId: "saas_approuter", contentAdditionMode: "manual", subdomain, subaccountId}`
  (from `HTML5_PROVIDER_ID`/`HTML5_CONTENT_ADDITION_MODE` constants + current
  `detectEnvironment()` result).
- Requires explicit confirmation (dedicated `Html5RefreshCard` + `ConfirmDialog` reuse).
- Disabled in the UI when subdomain/subaccountId aren't available.
- `Html5RefreshStatus`: triggered | authentication_required | authorization_denied |
  csrf_error | server_error | invalid_response | network_error.
- **Never auto-triggered** after a UI5 bulk update (explicit non-goal, blueprint §47).

## Files to create

```
src/integrations/sap-workzone/html5-refresh.ts
src/sidepanel/components/Html5RefreshCard.tsx
tests/unit/html5-refresh.test.ts
```

## TDD steps

1. `html5-refresh.test.ts` — payload shape exact match; each response class (200,
   401/403, CSRF rejection, 500, malformed JSON, network throw) maps to the right
   `Html5RefreshStatus`.
2. Implement `html5-refresh.ts` using Phase 2's client.
3. Wire `Html5RefreshCard` into the existing HTML5 tab placeholder in `App.tsx`.

## Acceptance criteria

- [ ] Payload matches blueprint §21 exactly.
- [ ] Card disabled (not just hidden) when environment context is missing.
- [ ] No code path calls this after a UI5 mutation completes.
