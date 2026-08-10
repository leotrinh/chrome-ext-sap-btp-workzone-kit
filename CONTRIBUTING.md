# Contributing to SAP BTP Workzone Kit

Thanks for taking a look. This project touches SAP BTP Work Zone administration —
if you don't already trust it, the fastest way to get there is to read the code
yourself. Contributions, bug reports, and blunt feedback are all genuinely welcome.

## Ways to contribute

- **Bug reports** — open an issue. Include repro steps, expected vs. actual behavior,
  and your Chrome/Edge version. Never paste real SAP tenant data, CSRF tokens, CDM, or
  other customer data into an issue — see [PRIVACY.md](PRIVACY.md) for what this
  project treats as sensitive.
- **Security issues** — do not open a public issue. Follow
  [SECURITY.md](SECURITY.md) instead.
- **Feature requests / ideas** — open an issue describing the problem you're trying to
  solve, not just the solution. Check
  [docs/project-roadmap.md](docs/project-roadmap.md) first in case it's already
  planned.
- **Pull requests** — welcome for bug fixes, test coverage, docs corrections, and
  roadmap items. For a larger change (new command, new permission, anything touching
  the SAP request/mutation flow), open an issue first so we can agree on the approach
  before you put in the work.

## Development setup

```bash
pnpm install
pnpm dev              # side panel dev server (UI only, outside the extension host)
pnpm test             # unit tests
pnpm typecheck
pnpm lint
pnpm build             # produces dist/
pnpm verify:manifest
pnpm verify:no-remote-code
pnpm ci                # the full chain CI runs
```

Load the built extension unpacked in Chrome/Edge via `chrome://extensions` →
Developer mode → "Load unpacked" → select `dist/`. See
[docs/deployment-guide.md](docs/deployment-guide.md) for the full manual QA checklist.

## Before opening a PR

- `pnpm ci` passes locally (typecheck, lint, tests, build, manifest/no-remote-code
  verification).
- New logic has test coverage — this project follows TDD for anything testable
  (business logic, hooks, pure functions). See existing files under `tests/unit/` for
  the pattern.
- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/)
  (`feat:`, `fix:`, `docs:`, `test:`, `chore:`, ...).
- No secrets, tokens, `.env` files, or real SAP tenant data in the diff.
- Keep PRs focused — one change, not a bundle of unrelated fixes.
- If your change touches permissions, the manifest, or how a SAP request is built,
  explain why in the PR description — those get extra scrutiny given what this
  extension has access to. See
  [docs/system-architecture.md](docs/system-architecture.md) for the current security
  boundaries and permission model.

## Code style

TypeScript strict mode, no `any`, no `console.log` in shipped code (`console.warn`/
`console.error` are fine for real diagnostics). React function components + hooks.
Match the patterns already in the file you're editing over introducing a new one.

## Code of conduct

Be respectful, assume good faith, keep disagreements about the code, not the person.
Reports of abusive behavior can go to the contact below.

## License

MIT — see [LICENSE](LICENSE). By contributing, you agree your contribution is
licensed under the same terms.

## Questions

Open an issue, or email Leo at tinhtd.info@gmail.com.
