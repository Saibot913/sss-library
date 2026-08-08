# Changelog

All notable changes to this project are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/); versioning follows [Semantic Versioning](https://semver.org/) (`MAJOR.MINOR.PATCH`, tracked in `package.json`):

- **MAJOR** — breaking change (something that worked before no longer does).
- **MINOR** — new feature, backwards compatible.
- **PATCH** — bug fix, no new feature.
- Version stays under `0.x.x` until there's a real, working first release — see [semver.org, point 4](https://semver.org/#spec-item-4).

## How to use this file

Every PR adds a line under `[Unreleased]`, in the right section (`Added` / `Changed` / `Fixed` / `Removed`). This is required, not optional: `.github/workflows/changelog.yml` fails any PR into `main` that doesn't touch this file — but the entry itself doesn't need to be a full writeup. A short, plain-language line is enough for most changes ("Fixed catalog sort order"); only add more detail when the *why* isn't obvious from the line alone (a non-obvious tradeoff, a workaround, something a reader would otherwise wonder about). Use judgment — terse by default.

When a set of changes is ready to be called a release: bump `version` in `package.json` following the rules above, rename `[Unreleased]` below to the new version number + today's date, and start a fresh empty `[Unreleased]` section above it.

## [Unreleased]

### Added
- `fetchBooks()` reads the real catalog from `books` + `copies` instead of throwing. Two things that aren't obvious from the code: the embedded `copies` select has to name its columns because `copies(*)` is rejected by the column-level grants added in 0.1.0, and the query is paged so it won't silently truncate at PostgREST's 1000-row cap as the catalog grows.
- Copies with a retired status (`lost`/`damaged`/`withdrawn`) are left out of both the available and total counts, so a book with permanently missing copies doesn't read as "3 of 5 available" forever. Nothing writes those statuses yet — only `available` and `checked_out` exist today.

- The catalog is cached in `localStorage` for five minutes rather than re-downloaded on every page load (~105 KB each time, for data that barely changes). Overlapping calls share one request, which also collapses the duplicate fetch `React.StrictMode` causes in dev. Five minutes matches the reservation hold window, so it adds no staleness the checkout flow doesn't already tolerate. `invalidateBooksCache()` is exported for the checkout flow to call once it exists.
- `staff` table, `is_staff()` helper, and a `return_book()` Postgres function (`supabase/migrations/0002_staff_role_and_returns.sql`) — closes the "no return path" and "no admin role" gaps: staff membership is granted by inserting a row via the Supabase Table Editor (no code or service-role access needed), and `return_book()` marks a checkout returned and puts the copy back on the shelf. No UI calls it yet — there's no admin panel — so it's callable directly via the SQL Editor or `supabase.rpc()` in the meantime.
- `thought_of_the_day` table (`supabase/migrations/0003_thought_of_the_day.sql`), public read policy, no client writes. Updated `thoughtForTheDay.ts`'s TODO and `ThoughtForTheDay` type to match the real (5-column) schema instead of the old 2-column plan. Table is empty until the daily scrape job is built — still undecided where that runs.

### Changed
- `auth.ts` stubs reshaped around the email + one-time-code flow: `requestSignInCode()` and `verifySignInCode()` replace `signIn(cardId, name)`, since a code flow is inherently two steps, and `onAuthChange()` is added so the UI tracks token refresh and cross-tab sign-out. `cardId` is gone from `Patron`. Still unimplemented — each function carries a `TODO(team)` naming the exact Supabase call.
- The task list now specifies email + one-time-code authentication, and drops library cards. Cards were Figma mockup leftovers — no card number exists anywhere in the database, and one couldn't serve as a credential regardless since it's printed on the card. Adds open decisions for who may sign up and who runs the mail sender.
- README now names a direct contact for repo access and Supabase credentials instead of "whoever owns this repo."
- Closed two open decisions: signup is open (`shouldCreateUser: true`, no member pre-loading) and the admin role now exists (`staff` table). `requestSignInCode()`'s TODO and the task list are updated accordingly. SMTP setup and category data cleanup stay open but are now flagged as the project owner's job, not the team's.

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
