# What needs to be built

This is the task list for the group. Everything backend-facing is already stubbed out in `src/lib/` with a `TODO(team)` comment describing the expected table shape and approach — nothing here needs to be designed from scratch, just built out.

Before picking something up: read [GIT_WORKFLOW.md](GIT_WORKFLOW.md) in this same folder — how we branch, commit, and open PRs.

## Checklist

### Core catalog (do this first — everything else depends on being able to see books)
- [ ] [`src/lib/books.ts`](../src/lib/books.ts) — `fetchBooks()`, reads the `books` + `copies` tables. This is the one stub already wired into `App.tsx` (runs the moment the page loads) — nothing renders until this works, so it's the first thing to build.
- [ ] [`src/lib/auth.ts`](../src/lib/auth.ts) — `signIn()` / `signOut()` / `getCurrentPatron()` via Supabase Auth. `LoginModal` in `App.tsx` currently fakes a login in local state — needs its `onLogin` callback pointed at `signIn()` instead.

### Checkout flow
- [ ] [`src/lib/checkouts.ts`](../src/lib/checkouts.ts) — already wraps working, race-safe Postgres functions (`supabase/migrations/0001_checkouts_and_reservations.sql` is applied and live). Just needs wiring into the UI:
  - Cart add/remove → `reserveCopy()` / `releaseReservation()`
  - `CartOverlay`'s "Submit Hold Requests" button (App.tsx:272, currently has no `onClick` at all) → `checkoutBook()`
  - Remember: cart currently tracks `book.id`, but reservations are per-*copy* (`full_label`) — picking which copy needs deciding.

### Content features (each needs a new table — schemas are sketched in the TODO comments)
- [ ] [`src/lib/events.ts`](../src/lib/events.ts) — **not decided yet, see the PROPOSAL comment in the file.** Leaning toward dropping calendar-scraping entirely and scoping "events" down to book club sessions only, plus a plain link out to saisevasadan.org/events for everything else. Discuss with the project owner before building either direction. Replaces the hardcoded `EVENTS` array (App.tsx:31).
- [ ] [`src/lib/bookClub.ts`](../src/lib/bookClub.ts) — `fetchBookClubSessions()` / `reserveBookClubSpot()`. Replaces the hardcoded `BOOK_CLUBS` array (App.tsx:906) with real sessions + working RSVP/capacity tracking — same race-condition shape as book checkout, see the TODO for the pattern to reuse.
- [ ] [`src/lib/thoughtForTheDay.ts`](../src/lib/thoughtForTheDay.ts) — daily thought scraped from sssmediacentre.org/sai-inspires. Has to run server-side (cross-origin scraping, not an API) on a daily schedule — see the TODO for options. Doesn't exist in `App.tsx` yet at all.
- [ ] [`src/lib/volunteers.ts`](../src/lib/volunteers.ts) / [`src/lib/donations.ts`](../src/lib/donations.ts) — wire the two forms in `AboutPage` to actually save submissions. Right now both just flip local state and discard what was typed.
- [ ] [`src/lib/bookCovers.ts`](../src/lib/bookCovers.ts) — cover art lookup. A first attempt at the Google Books API didn't work; needs debugging or a different source.
- [ ] [`src/lib/siteInfo.ts`](../src/lib/siteInfo.ts) — has the real name/address already. Still needs swapping into the fake placeholder in the `App.tsx` contact footer (~line 1232), and a decision on how to source hero images from saisevasadan.org (don't hotlink — see the file's TODO).
- [ ] **Service projects section** — not stubbed yet, doesn't exist in `App.tsx` at all. Seva/service projects are core to this kind of org and belong near the volunteering section. Cheapest version: a static array in `App.tsx`, same pattern as `VOLUNTEER_ROLES` — no backend needed unless it turns out to change often enough to need admin editing. Discuss your planned approach with the project owner before building.
- [ ] **Link to the main site** — a plain `<a href="https://www.saisevasadan.org">` somewhere in the footer/nav. Not really a "feature," just add it — no discussion needed.

### Reference
- [`src/lib/supabaseClient.ts`](../src/lib/supabaseClient.ts) — the configured Supabase client. Import `supabase` from here; don't create a second client anywhere.

## Known issues in `App.tsx` (found by reading the whole file — worth knowing before you touch it)

- `CartOverlay`'s "Submit Hold Requests" button (line 272) has no `onClick` at all — dead button, see Checkout flow above.
- The contact footer (line 1232) shows a fake placeholder address/phone/email.
- `STAFF` (line 38) is defined but never rendered anywhere — see Open decisions below.
- `EVENTS` (line 31) and `BOOK_CLUBS` (line 906) are hardcoded placeholder data, see Content features above.

## Open decisions (not code — need a team call before building)

- **Events scope** — see `src/lib/events.ts`'s PROPOSAL comment.
- **Admin role.** Several things (editing book club sessions, reading volunteer/donation submissions) assume someone is "staff," but there's no admin/staff concept anywhere yet. Until one exists, treat the Supabase dashboard as the admin panel.
- **`STAFF` array in `App.tsx` (line 38).** Either build the "meet the team" section it implies, or delete it.
- **Cover art source.** Retry Google Books (and actually read the error this time) vs. switch approach entirely.

## Ground rules

- Don't touch `App.tsx` wiring for a feature until its stub is actually implemented and tested against real Supabase data — half-wired features break the page for everyone else on `main`.
- RLS is on for every table. If a query silently returns nothing instead of erroring, check policies before assuming the code is wrong.
- Keep `.env` out of git (it already is). Never commit real Supabase keys anywhere, including in migration files or comments.
- **For anything marked "discuss before coding"** (a new data source, a new scraping job, a schema design for a brand-new feature) — bring your planned approach to the project owner before writing implementation code, not after. A `TODO`/`PROPOSAL` comment in a stub file is a starting point for that conversation, not a finalized spec to build against silently.
