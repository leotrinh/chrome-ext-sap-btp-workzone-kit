# Reviewer Instructions

Because full behavior requires an authenticated SAP BTP Work Zone admin session that
this repository does not (and must not) include credentials for, a human maintainer
needs to complete these steps before submission — they cannot be automated from CI or
by an AI agent working in this repository.

## What's needed

1. **Sanitized screen recording** — a short video showing: the floating button
   appearing on an eligible Work Zone admin page → opening the workspace tab →
   scanning apps → selecting one and setting a target version → the preview/confirm
   dialog → the update completing → verification result. Blur or redact the real
   tenant hostname, subaccount ID, and any real application names if the recording is
   made against a production-like tenant.
2. **Screenshots** — at minimum: the floating button on a Work Zone page, the Apps
   tab with a populated table, the update confirmation dialog, and the About tab
   (disclaimer visible).
3. **Permission walkthrough** — a short written or verbal explanation (can reuse
   `docs/store-listing.md`'s permission justification section) mapping each requested
   permission to a visible feature in the recording.
4. **Test tenant note (optional but recommended)** — if a non-production SAP BTP
   Work Zone tenant is available, note that in the submission notes so reviewers can
   attempt to reproduce the flow themselves. Never provide real production
   credentials to a reviewer, and never build a credential-bypass "demo mode" into
   the extension itself to make review easier — that would violate the same
   authentication model the extension exists to respect.

## What NOT to do

- Do not commit real Work Zone HTML, GraphQL responses, CDM, subaccount IDs, tenant
  hostnames, customer application names, cookies, CSRF tokens, or screenshots
  containing any of the above — see blueprint §39 / `docs/deployment-guide.md`.
- Do not implement any authentication bypass or backdoor to make reviewer testing
  more convenient.

## Current implementation status for reviewers

All ten blueprint phases' *code* is implemented (scan, UI5 inspection, planner,
mutation, verification, HTML5 refresh). What has **not** been done from this
repository: the manual `chrome://extensions` load-unpacked smoke test in a real
browser, and everything in this file. See `docs/compatibility.md` for the current
verification status in detail.
