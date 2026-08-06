# Changelog

All notable changes to this project are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/); versioning follows [Semantic Versioning](https://semver.org/) (`MAJOR.MINOR.PATCH`, tracked in `package.json`):

- **MAJOR** — breaking change (something that worked before no longer does).
- **MINOR** — new feature, backwards compatible.
- **PATCH** — bug fix, no new feature.
- Version stays under `0.x.x` until there's a real, working first release — see [semver.org, point 4](https://semver.org/#spec-item-4).

## How to use this file

Every PR adds a line under `[Unreleased]`, in the right section (`Added` / `Changed` / `Fixed` / `Removed`) — plain language, one or two lines, what changed and why if it's not obvious from the line itself. This is required, not optional: `.github/workflows/changelog.yml` fails any PR into `main` that doesn't touch this file.

When a set of changes is ready to be called a release: bump `version` in `package.json` following the rules above, rename `[Unreleased]` below to the new version number + today's date, and start a fresh empty `[Unreleased]` section above it.

## [Unreleased]

### Changed
- README now names a direct contact for repo access and Supabase credentials instead of "whoever owns this repo."

## [0.1.0] - 2026-08-05

### Added
- Supabase-backed stub layer in `src/lib/`: catalog reads, patron auth, race-safe checkout with 5-minute cart holds, book club RSVP scaffolding, and stubs for events, thought-of-the-day, volunteer/donation forms, and site info — none implemented yet, each with a `TODO(team)` describing the approach.
- `checkouts`/`copies` reservation schema, RLS policies, and Postgres functions applied to Supabase (`supabase/migrations/`).
- Supabase CLI initialized and linked to the project.
- `README.md` as a from-scratch setup guide, and `project-instructions/` with the task checklist and git workflow.

### Fixed
- `vite.config.ts` had a hard dependency on a Figma Make-generated file that doesn't exist outside that platform, which broke `pnpm dev`/`pnpm build` for anyone doing a plain clone.
- `.env.example` was silently excluded by the `.gitignore` pattern meant only for `.env` and was never actually committed.
- The catalog's public read policy exposed `reserved_by` (who has a copy on hold) to anyone; restricted via column-level grants.
