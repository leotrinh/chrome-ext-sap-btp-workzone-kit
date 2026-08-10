# Phase 10 — Store Release

Ref: blueprint §33-38, §41, §43.

## Requirements

- `PRIVACY.md`, `SECURITY.md` — already exist from the foundation round; review for
  accuracy once Phases 2-9 land (they currently describe capabilities as forward-looking;
  once real, tense/wording should reflect that).
- Store listing copy (`docs/store-listing.md`): name, short/long description, single
  purpose statement, permission justifications — mostly drafgeable directly from
  blueprint §34-36, adjusted for the final (reduced) permission set.
- `docs/reviewer-instructions.md`: sanitized screen recording + screenshots guidance
  (cannot produce real ones from this environment — human step).
- `docs/compatibility.md`: extension version, adapter version, last manual test date,
  Chrome/Edge versions, observed Work Zone route variants, known limitations.
- GitHub Actions CI workflow (`.github/workflows/ci.yml`) running `pnpm run ci` — not
  yet created; do here since it depends on the full script set being stable.
- Package version bump policy + `CHANGELOG.md` release section.

## Explicitly NOT done here (human-only)

- Actual Chrome Web Store submission.
- Real screenshots/screen recording of the extension against a live tenant.
- Trademark/name review with SAP if ever required.

## Acceptance criteria

- [ ] `pnpm run ci` green in GitHub Actions on a clean clone.
- [ ] Store listing docs exist and match actual implemented capabilities (no
      aspirational claims about unimplemented features).
- [ ] `pnpm package` produces a valid, reviewer-submittable zip.
