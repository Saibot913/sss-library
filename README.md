# SSS Library

React + Vite + Tailwind CSS front end for the library catalog, backed by Supabase.

## Setup

1. `pnpm install`
2. Copy `.env.example` to `.env` and fill in the two values from the Supabase project (Project Settings → API):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
3. `pnpm dev`

`.env` is gitignored — every teammate needs their own copy with the shared project's credentials (ask whoever owns the Supabase project for them).

New to the project? [project-instructions/README.md](project-instructions/README.md) has the task checklist, and [project-instructions/SETUP_AND_GIT_WORKFLOW.md](project-instructions/SETUP_AND_GIT_WORKFLOW.md) walks through cloning and the branch/commit/PR process.

## Repo layout

Files you likely won't need to touch, but might wonder about:

- **`.mise.toml`** — pins the Node.js/pnpm versions this project uses. Auto-applied if you have `mise` installed.
- **`pnpm-lock.yaml`** — lockfile for `pnpm` (this project's package manager — not `npm`/`yarn`). Auto-generated, never hand-edit.
- **`package.json`** — project manifest: scripts (`dev`/`build`/`preview`) and dependencies. Add a library with `pnpm add <package>`, don't edit this by hand.
- **`CLAUDE.md` / `AGENTS.md`** — instructions for AI coding assistants working in this repo (Claude Code, and others that support the AGENTS.md convention), not for you. `CLAUDE.md` just points at `AGENTS.md` so both read the same doc.

## Wiring up Supabase

The data layer is stubbed out but not implemented yet. Each stub has a `TODO(team)` comment with the expected table shape:

- [`src/lib/books.ts`](src/lib/books.ts) — `fetchBooks()`, reads the `books` + `copies` tables. Not implemented yet, but it's the one stub already wired into `App.tsx` (runs on page load), so it's the first thing to build.
- [`src/lib/auth.ts`](src/lib/auth.ts) — `signIn()` / `signOut()` / `getCurrentPatron()`, patron authentication via Supabase Auth.
- [`src/lib/checkouts.ts`](src/lib/checkouts.ts) — reserve/release/checkout a copy. Wraps the Postgres functions in [`supabase/migrations/0001_checkouts_and_reservations.sql`](supabase/migrations/0001_checkouts_and_reservations.sql) — the race-safety and the 5-minute cart hold are enforced in the database, not in this file.
- [`src/lib/bookCovers.ts`](src/lib/bookCovers.ts) — `useBookCover()`, cover art lookup. Not stored in Supabase; a first attempt at the Google Books API didn't work and wasn't debugged further.
- [`src/lib/events.ts`](src/lib/events.ts) — `fetchEvents()`, pulls the calendar from https://www.saisevasadan.org/events (a public Google Calendar).
- [`src/lib/bookClub.ts`](src/lib/bookClub.ts) — `fetchBookClubSessions()` / `reserveBookClubSpot()`. Matches the real feature already in `App.tsx`'s `BOOK_CLUBS` array: multiple recurring sessions, each with capacity + a live "spots left" count and a working "Reserve a Spot" button — same race-condition shape as book checkout, see the TODO for the pattern to reuse.
- [`src/lib/thoughtForTheDay.ts`](src/lib/thoughtForTheDay.ts) — daily thought scraped from https://www.sssmediacentre.org/sai-inspires/. Has to run server-side (cross-origin scraping, not an API) on a daily schedule — see the TODO for options.
- [`src/lib/volunteers.ts`](src/lib/volunteers.ts) — `submitVolunteerApplication()`. The volunteer sign-up form in `AboutPage` currently discards its submission; needs a table to actually save it.
- [`src/lib/donations.ts`](src/lib/donations.ts) — `submitBookDonation()`. Same situation as volunteers — the donation form goes nowhere right now.
- [`src/lib/siteInfo.ts`](src/lib/siteInfo.ts) — static contact info (name/address) plus a note on sourcing hero images from saisevasadan.org without hotlinking.
- [`src/lib/supabaseClient.ts`](src/lib/supabaseClient.ts) — the configured Supabase client; import `supabase` from here, don't create a second client.

None of the new stubs (`checkouts`, `events`, `bookClub`, `thoughtForTheDay`, `volunteers`, `donations`, `siteInfo`) are wired into `App.tsx` yet — that's part of the work. A few specific things found while auditing `App.tsx` for what's still hardcoded or dead, worth knowing before you start:

- `EVENTS` (App.tsx:31) and `BOOK_CLUBS` (App.tsx:906) are hardcoded placeholder data — `events.ts` and `bookClub.ts` are meant to replace them.
- `CartOverlay`'s "Submit Hold Requests" button (App.tsx:272) has no `onClick` at all currently — it's the spot where `checkoutBook()`/`reserveCopy()` from `checkouts.ts` need to be called.
- The contact footer (App.tsx:1232) has a fake placeholder address/phone/email — swap in `siteInfo.ts`'s real address once that's decided.
- `STAFF` (App.tsx:38) is defined but never rendered anywhere in the file — either a "meet the team" section was planned and dropped, or it's dead code to delete. Worth a team decision either way.

Each teammate needs their own `.env` (step 2 above) to actually hit Supabase — cloning the repo alone doesn't wire anything up by itself.
