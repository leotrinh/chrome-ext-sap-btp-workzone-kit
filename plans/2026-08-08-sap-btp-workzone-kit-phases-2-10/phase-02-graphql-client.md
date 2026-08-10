# Phase 2 — CSRF + GraphQL Client

Ref: blueprint §3.4 (CSRF), §11 (GraphQL client), §27 (error codes).

## Requirements

- `HEAD /semantic/graphql` with `x-csrf-token: Fetch` header → read `x-csrf-token`
  response header. Cache in content-script module memory only (never persisted, never
  sent to the React UI).
- Fixed GraphQL client: relative same-origin URL, `Content-Type: application/json`,
  `X-CSRF-Token` header, `credentials: "same-origin"`.
- Classify failures into `WorkzoneRequestErrorCode` (blueprint §11): auth/authorization/
  CSRF/HTTP/GraphQL/invalid-response/network/page-changed/unknown.
- Refresh CSRF once and retry on a CSRF-rejection response (403 with CSRF-specific
  signal), not on every request.

## Files to create

```
src/integrations/sap-workzone/csrf.ts
src/integrations/sap-workzone/graphql-client.ts
src/integrations/sap-workzone/response-classifier.ts
src/shared/errors.ts (WorkzoneRequestErrorCode + typed error shape — real consumer now)
tests/unit/response-classifier.test.ts
tests/unit/csrf.test.ts (pure parsing/classification logic only; fetch itself mocked)
```

## TDD steps

1. `response-classifier.test.ts` — given an HTTP status + body shape, returns the right
   `WorkzoneRequestErrorCode`. Pure function, fully testable.
2. Implement `response-classifier.ts`.
3. `csrf.test.ts` — mock `fetch`, assert token extraction from headers, assert
   AUTHENTICATION_REQUIRED on 401, CSRF_MISSING when header absent on 200.
4. Implement `csrf.ts` + `graphql-client.ts` (thin fetch wrapper using the classifier).

## Acceptance criteria

- [ ] CSRF token never appears in any `WorkzoneCommandResponse` sent to the UI.
- [ ] All classifier branches unit tested.
- [ ] No raw request/response bodies logged.
