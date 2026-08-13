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
- `thought_of_the_day` table (`supabase/migrations/0003_thought_of_the_day.sql`), public read policy, no client writes. Updated `thoughtForTheDay.ts`'s TODO and `ThoughtForTheDay` type to match the real (5-column) schema instead of the old 2-column plan. Table is empty until the importer below runs for the first time.
- Thought-for-the-day importer in `tools/thought-of-the-day/`: a Google Apps Script on a daily trigger that parses the Sai Inspires group email and upserts into `thought_of_the_day`, with setup instructions in its README. Email rather than scraping because all three web sources turned out unusable — the site renders its content with JavaScript so a plain fetch returns empty placeholders, `archive.sssmediacentre.org` serves a broken TLS chain, and the Google Group archive is private. Only the import side; nothing reads the table yet.
- `fetchThoughtForTheDay()` reads the imported thought — the newest row, including future-dated ones. The emails are published on India time, so from about 2pm Pacific the newest row is dated tomorrow; showing it straight away was preferred over holding it until midnight, which would leave the section blank for the rest of every day and all of the first one. Two consequences: don't label the section "today's thought" if the date is displayed, and a broken importer is invisible on the page because the last row keeps serving — the trigger's failure notifications are the only warning. Nothing renders it yet; `App.tsx` has no thought-of-the-day section.
- New `AboutPage` section, "Reviews & Feedback" (`src/lib/reviews.ts`), same Google Form pattern as volunteer sign-up — name, contact, a review-type dropdown, and a text box. Not per-book reviews shown on the site; that bigger version is noted as an open decision for later.
- Site-wide password gate (`src/lib/siteAccess.ts`, `SiteGate` in `App.tsx`) — nothing renders until the shared community password is entered once; remembered afterward via `localStorage`. Not real data security (the catalog's RLS policies still allow public reads directly against Supabase) — see the file's comment for the reasoning. Sits in front of the existing public-browsing / signed-in-patron tiers, doesn't change either.
- `siteInfo.ts` now has the real meeting room (`MEETING_ROOM`) and weekly timings (`WEEKLY_TIMINGS`) — not wired into `App.tsx` yet, that's a task for the team (see `project-instructions/README.md`).
- Site-wide bigger UI via `zoom: 1.15` on `html` (`src/index.css`) for readability — `zoom`, not a font-size bump, since every style in `App.tsx` is a hardcoded px inline style rather than rem-based.

- Custom SMTP configured on the Supabase project, so auth emails actually send — the built-in sender caps at a handful per hour and is explicitly not for production. The whole flow is verified end to end with no app code, against the two REST endpoints `signInWithOtp`/`verifyOtp` wrap: `POST /auth/v1/otp` returns 200 and a six-digit code arrives, `POST /auth/v1/verify` exchanges it for an `access_token`. Nothing unknown is left in the auth backend, so `auth.ts` is now wiring around calls known to work — both commands are in `project-instructions/README.md` for isolating app bugs from backend ones. Caveat: mail currently goes out through a Gmail account and **codes land in spam**, which unblocks development but not real members; see Open decisions there.

- Daily Thought page at `/thought`, linked from the nav — the short quote as the centrepiece, then the teaser line, the discourse split on its paragraph breaks, and the attribution. Handles loading, error and empty states. Deliberately **not** labelled "today's thought": the mail is published on India time, so the newest row is usually dated tomorrow and a "today" label would contradict the date shown next to it. Dates are formatted from their parts rather than `new Date(iso)`, which parses as UTC midnight and would render every thought a day early anywhere west of Greenwich.
- Real URLs for each page via `react-router-dom` (`/`, `/catalog`, `/thought`, `/community`), replacing the state-based view switching — pages can now be linked to, bookmarked and refreshed, and the back button moves between them instead of leaving the site. Unknown paths redirect home, and scroll resets on navigation. Two things to know: book detail is still component state so individual books have no URL yet, and `BrowserRouter` needs the host to serve `index.html` for unknown paths (Vercel/Netlify do this for Vite SPAs by default; a plain static server will 404 when someone refreshes `/catalog`).

### Changed
- `auth.ts` stubs reshaped around the email + one-time-code flow: `requestSignInCode()` and `verifySignInCode()` replace `signIn(cardId, name)`, since a code flow is inherently two steps, and `onAuthChange()` is added so the UI tracks token refresh and cross-tab sign-out. `cardId` is gone from `Patron`. Still unimplemented — each function carries a `TODO(team)` naming the exact Supabase call.
- The task list now specifies email + one-time-code authentication, and drops library cards. Cards were Figma mockup leftovers — no card number exists anywhere in the database, and one couldn't serve as a credential regardless since it's printed on the card. Adds open decisions for who may sign up and who runs the mail sender.
- README now names a direct contact for repo access and Supabase credentials instead of "whoever owns this repo."
- Closed two open decisions: signup is open (`shouldCreateUser: true`, no member pre-loading) and the admin role now exists (`staff` table). `requestSignInCode()`'s TODO and the task list are updated accordingly. SMTP setup and category data cleanup stay open but are now flagged as the project owner's job, not the team's.
- Volunteer sign-up simplified to name / contact / area-of-interest, and no longer a custom Supabase-backed form — `AboutPage` now links out to an external Google Form (`VOLUNTEER_FORM_URL` in `src/lib/volunteers.ts`, not yet set) instead. Cheaper to maintain for a small team and comes with a response spreadsheet for free.

### Removed
- Book donations feature (form + info section in `AboutPage`, `src/lib/donations.ts`) pulled from V1 scope entirely — deferred, not abandoned, may return as a later feature.

### Fixed
- The thought-of-the-day importer's setup docs said to use a new-style `sb_secret_` key, which cannot work: Supabase rejects secret keys when the `User-Agent` looks like a browser, Apps Script's starts with `Mozilla/5.0`, and Apps Script strips any `User-Agent` you set. It now says to use the legacy `service_role` JWT, and notes that legacy keys retire at the end of 2026 along with the two ways out (an Edge Function in front, or moving the job to GitHub Actions over IMAP).

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
