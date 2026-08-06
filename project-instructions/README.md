# What needs to be built

This is the task list for the group. Everything backend-facing is already stubbed out in `src/lib/` with a `TODO(team)` comment describing the expected table shape and approach — nothing here needs to be designed from scratch, just built out. See the main [README.md](../README.md) for the full file-by-file index.

Before picking something up: read [SETUP_AND_GIT_WORKFLOW.md](SETUP_AND_GIT_WORKFLOW.md) in this same folder — cloning, `.env`, and branch/commit/PR conventions so the group stays consistent.

## Checklist

### Core catalog (do this first — everything else depends on being able to see books)
- [ ] `src/lib/books.ts` — `fetchBooks()`. This is the one already wired into `App.tsx`; nothing renders until this works.
- [ ] `src/lib/auth.ts` — `signIn()` / `signOut()` / `getCurrentPatron()` via Supabase Auth. `LoginModal` in `App.tsx` needs its `onLogin` callback pointed at this instead of the fake local-state login it has now.

### Checkout flow
- [ ] `src/lib/checkouts.ts` — already wraps working, race-safe Postgres functions (`supabase/migrations/0001_checkouts_and_reservations.sql` is applied and live). Just needs wiring into the UI:
  - Cart add/remove → `reserveCopy()` / `releaseReservation()`
  - `CartOverlay`'s "Submit Hold Requests" button (currently has no `onClick` at all) → `checkoutBook()`
  - Remember: cart currently tracks `book.id`, but reservations are per-*copy* (`full_label`) — picking which copy needs deciding.

### Content features (each needs a new table — schemas are sketched in the TODO comments)
- [ ] `src/lib/events.ts` — **not decided yet, see the PROPOSAL comment in the file.** Leaning toward dropping calendar-scraping entirely and scoping "events" down to book club sessions only, plus a plain link out to saisevasadan.org/events for everything else. Discuss with the project owner before building either direction.
- [ ] `src/lib/bookClub.ts` — replace the hardcoded `BOOK_CLUBS` array with real sessions + working RSVP/capacity tracking.
- [ ] `src/lib/thoughtForTheDay.ts` — needs a daily server-side job (not client-side — it's cross-origin scraping), see TODO for scheduler options.
- [ ] `src/lib/volunteers.ts` / `src/lib/donations.ts` — wire the two forms in `AboutPage` to actually save submissions instead of discarding them.
- [ ] `src/lib/bookCovers.ts` — cover art lookup. A first attempt at the Google Books API didn't work; needs debugging or a different source.
- [ ] `src/lib/siteInfo.ts` — has the real address already; still needs the fake placeholder in the `App.tsx` contact footer (~line 1232) swapped out, and a decision on how to source hero images from saisevasadan.org.
- [ ] **Service projects section** — not stubbed yet, doesn't exist in `App.tsx` at all. Seva/service projects are core to this kind of org and belong near the volunteering section. Cheapest version: a static array in `App.tsx`, same pattern as `VOLUNTEER_ROLES` — no backend needed unless it turns out to change often enough to need admin editing. Discuss your planned approach with the project owner before building.
- [ ] **Link to the main site** — a plain `<a href="https://www.saisevasadan.org">` somewhere in the footer/nav. Not really a "feature," just add it — no discussion needed.

## Open decisions (not code — need a team call before building)

- **Events scope** — see `src/lib/events.ts`'s PROPOSAL comment above.
- **Admin role.** Several things (editing book club sessions, reading volunteer/donation submissions) assume someone is "staff," but there's no admin/staff concept anywhere yet. Until one exists, treat the Supabase dashboard as the admin panel.
- **`STAFF` array in `App.tsx` (line 38)** is defined but never rendered anywhere. Either build the "meet the team" section it implies, or delete it.
- **Cover art source.** Retry Google Books (and actually read the error this time) vs. switch approach entirely.

## Ground rules

- Don't touch `App.tsx` wiring for a feature until its stub is actually implemented and tested against real Supabase data — half-wired features break the page for everyone else on `main`.
- RLS is on for every table. If a query silently returns nothing instead of erroring, check policies before assuming the code is wrong.
- Keep `.env` out of git (it already is). Never commit real Supabase keys anywhere, including in migration files or comments.
- **For anything marked "discuss before coding"** (a new data source, a new scraping job, a schema design for a brand-new feature) — bring your planned approach to the project owner before writing implementation code, not after. A `TODO`/`PROPOSAL` comment in a stub file is a starting point for that conversation, not a finalized spec to build against silently.
