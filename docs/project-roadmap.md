# Project Roadmap

Last Updated: 2026-08-08

## Overview

SAP BTP Workzone Kit is planned as a **10-phase product** (blueprint §42). **Phases 0-1 are complete.** This document outlines Phases 2-10 at a high level; see `hand-off/sap-btp-workzone-kit-codex-blueprint.md` for complete specification details, design requirements, and API contracts.

## Completed Phases

### Phase 0: Foundation (✓ Done)
- Manifest V3 project scaffold
- React + TypeScript + Vite build pipeline
- Service worker shell with side-panel setup
- Test framework (Vitest) and linting (ESLint)
- Build verification scripts (manifest validation, no-remote-code audit)

### Phase 1: Connection (✓ Done)
- Service worker eligibility gating (HTTPS + SAP BTP host + supported routes)
- MAIN-world page runtime (`window.__BTP_WORKZONE_KIT__`)
- Fixed command protocol with Zod validation
- Environment detection (subaccount/subdomain from hostname + SAP metadata fallback)
- React side panel: Connection status card, About panel, Footer with branding
- Implemented commands: `PING`, `GET_ENVIRONMENT`
- 54 passing unit tests covering eligibility, environment, protocol, and manifest

## Upcoming Phases

### Phase 2: CSRF & GraphQL Client

**Goal:** Establish secure, authenticated communication with SAP Work Zone's GraphQL endpoint.

**Work:**
- CSRF token retrieval via HEAD request to `/semantic/graphql` (header: `x-csrf-token: Fetch`)
- CSRF token caching with refresh logic (expire on 401/403 response)
- GraphQL query builder for Work Zone's `/semantic/graphql` endpoint
- Error handling: Classify 401 (auth failed), 403 (insufficient permissions), 5xx (backend error)
- Keep CSRF token inside page runtime only; never expose to panel

**Commands:** None yet (infrastructure layer)

---

### Phase 3: App Scanning

**Goal:** Discover and enumerate all local business apps in the current subaccount.

**Work:**
- Implement `getEntities` GraphQL query (businessapp entity type)
- Pagination via continuation tokens (50 items per page)
- Filter: `baseId === null` (local apps only, not inherited from parent scopes)
- Concurrency limiter: Load app details in batches of 5 (avoid rate limits)
- Caching: Store app list with expiry (e.g., 10 min) to avoid re-scanning on repeated commands

**New commands:**
- `SCAN_APPS` — Initiate discovery, return paginated list of app IDs, titles, types

**UI:** Search/filter by app name, sort by name/config

---

### Phase 4: UI5 Version Inspection

**Goal:** Detect current SAPUI5 version configuration for each app.

**Work:**
- Implement `getEntity` GraphQL query (single app detail with CDM)
- UI5 version path detection: Support both known locations
  - Path A: `targetAppConfig["sap.integration"].urlTemplateParams.query["sap-ui-version"]`
  - Path B: `visualizations[key].vizConfig["sap.flp"].target.parameters["sap-ui-version"].value`
- Version consistency check: Report "Mixed" if multiple targets have different versions
- Mark targets as read-only or writable (mutation readiness)

**New commands:**
- `GET_APP_VERSION_TARGETS` — Return all UI5 version targets + current values + write permissions

**UI:** Display version per app, highlight inconsistencies

---

### Phase 5: Update Planner

**Goal:** Stage bulk updates with preview before execution.

**Work:**
- Global default UI5 version setting (e.g., 1.137.0)
- Per-app override UI5 version
- Build preview: Show which apps + targets will change to what version
- Validation: Check write permissions on all targets
- Select all / select per-row / deselect functionality

**New commands:**
- `BUILD_UPDATE_PLAN` — Given apps and target version, return preview of changes (no mutation yet)

**UI:** Multi-step workflow: Inspect → Select → Preview → Confirm

---

### Phase 6: Mutation

**Goal:** Execute bulk UI5 version updates via GraphQL batchProcess mutation.

**Work:**
- batchProcess CDM mutation builder (batch up to N updates per request)
- Sequential mutation execution (per app, per target)
- CSRF token refresh before each batch (if expired)
- Mutation delay: 300ms between batches (SAP rate limiting)
- Error recovery: Rollback plan on first critical failure, skip non-critical errors

**New commands:**
- `UPDATE_APP_UI5_VERSION` — Execute mutation for selected apps/targets

**UI:** Progress bar, status per app (pending/success/error), retry logic

---

### Phase 7: Verification

**Goal:** Confirm all mutations applied correctly.

**Work:**
- Re-query updated apps to verify new versions persisted
- Detect rollbacks or reverts (version changed again after update)
- Report per-app verification status
- Build a verification report (JSON export or UI summary)

**New commands:**
- `VERIFY_APP_UI5_VERSION` — Re-scan apps, confirm all targeted versions now match plan

**UI:** Verification results card, per-app status checkmarks

---

### Phase 8: HTML5 Provider Refresh

**Goal:** Trigger manual HTML5 content refresh after bulk updates.

**Work:**
- Endpoint discovery: `/semantic/entity/provider/html5`
- Refresh trigger: POST to HTML5 endpoint with CSRF token
- Status polling: Check refresh completion
- Error handling: Timeout, backend errors, permission issues

**New commands:**
- `REFRESH_HTML5_CONTENT` — Trigger manual refresh, poll until complete

**UI:** Refresh button, status message, completion notification

---

### Phase 9: Store Release (Chrome Web Store)

**Goal:** Publish extension to Chrome Web Store and (optional) Edge Add-ons.

**Work:**
- Generate store-required assets: 128x128 icon (high res), 1280x800 screenshot, short/long descriptions
- Privacy policy (data handling: no cookies, no credentials, only command logs)
- Terms of service (independent product, not SAP-affiliated)
- Store listing copy: Problem statement, product promise, supported routes, FAQs
- Submission to Chrome Web Store (review process, address feedback cycles)
- Signing/packaging: Create .zip with manifest, all assets, signatures

**UI:** None (backend/metadata)

---

### Phase 10: Polish & Hardening

**Goal:** Production readiness, performance, edge cases.

**Work:**
- Performance optimization: Lazy load phase handlers, debounce UI updates
- Accessibility audit: WCAG 2.1 AA compliance
- Error message refinement: User-friendly copy for each error code
- Telemetry (optional, privacy-preserving): Track command usage (no PII), errors by code
- Documentation: User guide, troubleshooting, privacy policy, support links
- Automated end-to-end testing (load-unpacked flow, command execution)

**UI:** Help/settings panel, privacy banner, telemetry opt-out (if added)

---

## Dependency Chain

```
Phase 0 (Foundation)
  ↓
Phase 1 (Connection) — Can PING & detect environment
  ↓
Phase 2 (CSRF & GraphQL) — Infrastructure for all phases below
  ↓
Phase 3 (Scanning) → Phase 4 (Inspection) → Phase 5 (Planner)
  ↓
Phase 6 (Mutation) → Phase 7 (Verification) → Phase 8 (Refresh)
  ↓
Phase 9 (Store Release)
  ↓
Phase 10 (Polish)
```

**Note:** Phases 3-8 can be reordered or run in parallel once Phase 2 is complete (they share the GraphQL client infrastructure).

## Known Unknowns

- **SAP BTP schema changes:** Work Zone GraphQL API may evolve; versioning strategy TBD
- **Rate limiting:** Actual rate limits and optimal batch size TBD (currently assuming 300ms between batches)
- **CSRF token expiry:** Real SAP timeouts TBD (implement refresh-on-401 as fallback)
- **Store review:** Chrome Web Store review process may require additional privacy/security disclosures
- **User feedback:** Feature prioritization (e.g., selective mutation vs. bulk-only) pending real-world usage

## Non-Goals (Explicitly Out of Scope)

- Backend authentication: No SAP credentials stored in extension (use SAP session)
- OAuth/OIDC implementation: Defer to SAP's built-in session
- Multiple subaccount support in one session: One tab = one SAP session (future multi-tab UI possible)
- Custom UI5 library override: Only update `sap-ui-version` paths, not point to custom builds
- Rollback/undo: Mutation is permanent (user must manually revert if needed)
- Real-time sync: No background polling or WebSocket listeners

## Success Metrics

- Users can inspect UI5 versions in < 5 seconds from panel open
- Bulk update 50+ apps in < 2 minutes (including preview + confirmation)
- < 1% mutation failure rate (assuming stable SAP backend)
- Store listing 100+ downloads (TBD after release)
- < 5% user-reported security or privacy issues

## Support Timeline

- **Phase 0-1 complete:** 2026-08-08 (this session)
- **Phase 2-3 target:** 2026-09 (CSRF + scanning)
- **Phase 4-5 target:** 2026-10 (inspection + planner)
- **Phase 6-8 target:** 2026-11 (mutation + verification + refresh)
- **Phase 9-10 target:** 2026-12 (Store release + polish)

**Note:** Dates are aspirational; depends on community feedback and SAP schema stability.
