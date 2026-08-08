# Security Policy — SAP BTP Workzone Kit

## Reporting a vulnerability

Please report suspected security issues by opening a private security advisory on
GitHub (Security tab → "Report a vulnerability") at
https://github.com/leotrinh/chrome-ext-sap-btp-workzone-kit, or by opening a regular
issue if you believe the report is not sensitive. Do not include real SAP tenant data,
CDM, tokens, or other customer data in any report.

## Scope and security model

- No SAP credentials, cookies, or CSRF tokens are ever read, stored, or exposed to the
  extension's side panel — see [PRIVACY.md](PRIVACY.md) for the full data-handling
  policy.
- Chrome/Edge permissions are limited to `storage`, `sidePanel`, plus one content script
  scoped to `*://*.hana.ondemand.com/*` (floating-button discovery UI + command
  execution — see `docs/system-architecture.md`). No `activeTab`, no `scripting`, no
  `host_permissions`, no `<all_urls>`, no `cookies`/`webRequest`.
- All executable code is bundled at build time — no remote scripts, no `eval`, no
  `new Function`. Verified by `pnpm verify:no-remote-code` in CI.
- The side panel can only request a fixed, schema-validated set of commands from the
  packaged page runtime — never an arbitrary URL, GraphQL document, or script.
- Every mutating action requires explicit user confirmation before it runs (see
  `hand-off/sap-btp-workzone-kit-codex-blueprint.md` §48 for the full safety-invariant
  list this project is built against).

## Supported versions

This project is pre-1.0 and does not yet have a formal support/patch policy. Security
fixes land on the default branch as soon as they're available.
