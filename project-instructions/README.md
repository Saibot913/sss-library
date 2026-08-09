# What needs to be built

This is the task list for the group. Everything backend-facing is already stubbed out in `src/lib/` with a `TODO(team)` comment describing the expected table shape and approach — nothing here needs to be designed from scratch, just built out.

Before picking something up: read [GIT_WORKFLOW.md](GIT_WORKFLOW.md) in this same folder — how we branch, commit, and open PRs.

## Checklist

### Core catalog (do this first — everything else depends on being able to see books)
- [ ] [`src/lib/books.ts`](../src/lib/books.ts) — `fetchBooks()`, reads the `books` + `copies` tables. This is the one stub already wired into `App.tsx` (runs the moment the page loads) — nothing renders until this works, so it's the first thing to build.
- [ ] [`src/lib/auth.ts`](../src/lib/auth.ts) — `requestSignInCode()` / `verifySignInCode()` / `signOut()` / `getCurrentPatron()` / `onAuthChange()` via Supabase Auth. All five are stubbed with step-by-step `TODO(team)` comments naming the exact Supabase calls; start there. **Decided: authentication is by email, with no password.** The patron types their email, Supabase emails them a six-digit code, they type it back (`signInWithOtp`, then `verifyOtp`). Prefer the code over a magic link — on phones a link often opens in a different browser than the one that asked for it, and the session lands in the wrong place.

  Two reasons for no password: people use a library site a few times a year, which is exactly when passwords get forgotten, and every forgotten one becomes a support request to a volunteer.

  **Library cards are not part of this — remove them.** `LoginModal` asks for a "Library Card Number" and `Patron` carries a `cardId`, but both are Figma mockup leftovers: no card number exists anywhere in the database, and the center doesn't appear to issue cards at all. A card number couldn't be a credential regardless — it's printed on the card and readable by anyone at the desk, so it identifies you without proving anything. Drop the field from `LoginModal` and `cardId` from `Patron` as part of this task.

  The stub previously offered a custom `patrons` table keyed by card number as an alternative to Supabase Auth. That option is closed and has been removed: the migration is already live and hardwired to Supabase Auth — `checkouts.user_id` is a foreign key to `auth.users(id)`, every RLS policy is written against `auth.uid()`, and all three checkout functions are granted to the `authenticated` role. Building a custom table would mean rewriting working, race-safe SQL.

  `LoginModal` currently fakes a login in local state and accepts any name typed into it. Point its `onLogin` callback at `signIn()`; the form becomes email → code, and the patron's display name comes from their account rather than being typed at login. Note that supabase-js persists the session and refreshes tokens on its own, so `getCurrentPatron()` should read `supabase.auth.getSession()` and subscribe to `onAuthStateChange` rather than being a one-shot fetch — otherwise the UI won't notice a sign-out in another tab.

  **Decided: signup is open** (`shouldCreateUser: true` in `signInWithOtp`) — anyone with an email can register and place holds, no member list to pre-load. Abuse isn't prevented up front; it's handled after the fact by staff, who can now be identified via the `staff` table (`is_staff()`, `supabase/migrations/0002_staff_role_and_returns.sql`) — there's no admin UI for cancelling a hold yet, but the pieces to build one exist.

### Checkout flow
- [ ] [`src/lib/checkouts.ts`](../src/lib/checkouts.ts) — already wraps working, race-safe Postgres functions (`supabase/migrations/0001_checkouts_and_reservations.sql` is applied and live). Just needs wiring into the UI:
  - Cart add/remove → `reserveCopy()` / `releaseReservation()`
  - `CartOverlay`'s "Submit Hold Requests" button (App.tsx:272, currently has no `onClick` at all) → `checkoutBook()`
  - Remember: cart currently tracks `book.id`, but reservations are per-*copy* (`full_label`) — picking which copy needs deciding.
- [ ] **Staff returns UI** — not started, doesn't exist in `App.tsx` at all yet. `return_book(full_label)` (`supabase/migrations/0002_staff_role_and_returns.sql`) marks a checkout returned and puts the copy back on the shelf, gated to the new `staff` table via `is_staff()`. No admin panel exists to call it from — for now staff can call it directly via the Supabase SQL Editor or `supabase.rpc('return_book', { p_full_label })` from the browser console while signed in as a staff account. Building an actual UI for this (and for admin generally) is open-ended; discuss scope with the project owner before starting.

### Content features (each needs a new table — schemas are sketched in the TODO comments)
- [ ] [`src/lib/events.ts`](../src/lib/events.ts) — **not decided yet, see the PROPOSAL comment in the file.** Leaning toward dropping calendar-scraping entirely and scoping "events" down to book club sessions only, plus a plain link out to saisevasadan.org/events for everything else. Discuss with the project owner before building either direction. Replaces the hardcoded `EVENTS` array (App.tsx:31).
- [ ] [`src/lib/bookClub.ts`](../src/lib/bookClub.ts) — `fetchBookClubSessions()` / `reserveBookClubSpot()`. Replaces the hardcoded `BOOK_CLUBS` array (App.tsx:906) with real sessions + working RSVP/capacity tracking — same race-condition shape as book checkout, see the TODO for the pattern to reuse.
- [ ] [`src/lib/thoughtForTheDay.ts`](../src/lib/thoughtForTheDay.ts) — daily thought scraped from sssmediacentre.org/sai-inspires. Has to run server-side (cross-origin scraping, not an API) on a daily schedule — see the TODO for options. Doesn't exist in `App.tsx` yet at all.
- [x] [`src/lib/volunteers.ts`](../src/lib/volunteers.ts) — **decided: no custom form/table.** Volunteer interest is collected via an external Google Form instead — simpler to maintain for a small team, free spam protection, and a response spreadsheet with no admin UI to build. `AboutPage`'s volunteer section now links out to `VOLUNTEER_FORM_URL` (currently empty — see the TODO in the file for how to create and link the actual form).
- ~~`src/lib/donations.ts`~~ — **removed from V1 scope entirely.** Not being built right now; deferred, not abandoned. The project owner has the original stub + removed UI preserved for later if it comes back.
- [ ] [`src/lib/bookCovers.ts`](../src/lib/bookCovers.ts) — cover art lookup. A first attempt at the Google Books API didn't work; needs debugging or a different source.
- [ ] [`src/lib/siteInfo.ts`](../src/lib/siteInfo.ts) — has the real name/address/room and weekly timings now. Two wiring tasks:
  - Swap `SITE_NAME`/`SITE_ADDRESS`/`MEETING_ROOM` into the fake placeholder in the `App.tsx` contact footer (~line 1232).
  - Replace the fake "Hours" strip on the home page (`App.tsx` ~line 869-878 — currently a made-up Mon–Thu/Fri–Sat/Sunday library-hours array, Figma leftover) with `WEEKLY_TIMINGS` instead — this center's real weekly schedule (Thursday Bhajans, Sunday Sai Center), not library opening hours at all.
  - Also still needs a decision on how to source hero images from saisevasadan.org (don't hotlink — see the file's TODO).
- [x] [`src/lib/reviews.ts`](../src/lib/reviews.ts) — **decided: same pattern as volunteers.ts.** A general reviews/feedback form (not per-book reviews shown on the site — see Open decisions below for that bigger idea, deferred) — name, contact, a Book Review/Website-Library Review dropdown, and a text box. Links out to an external Google Form via `REVIEW_FORM_URL` (currently empty, same setup as the volunteer form). New `AboutPage` section, § 03, right below Volunteers.
- [ ] **Service projects section** — not stubbed yet, doesn't exist in `App.tsx` at all. Seva/service projects are core to this kind of org and belong near the volunteering section. Cheapest version: a static array in `App.tsx`, same pattern as `VOLUNTEER_ROLES` — no backend needed unless it turns out to change often enough to need admin editing. Discuss your planned approach with the project owner before building.
- [ ] **Link to the main site** — a plain `<a href="https://www.saisevasadan.org">` somewhere in the footer/nav. Not really a "feature," just add it — no discussion needed.
- [x] [`src/lib/siteAccess.ts`](../src/lib/siteAccess.ts) — **decided: three access tiers.** A permanent shared-password gate sits in front of the entire site ("our community only" — not real data security, see the comment in the file for why). Below that, browsing stays public (guest view), and real sign-in (`auth.ts`) still separately unlocks holds/staff features on top, unchanged. Password is `loveallserveall`; entering it once is remembered per-browser via `localStorage` so it isn't asked every visit.

### Reference
- [`src/lib/supabaseClient.ts`](../src/lib/supabaseClient.ts) — the configured Supabase client. Import `supabase` from here; don't create a second client anywhere.

## Known issues in `App.tsx` (found by reading the whole file — worth knowing before you touch it)

- `CartOverlay`'s "Submit Hold Requests" button (line 272) has no `onClick` at all — dead button, see Checkout flow above.
- The contact footer (line 1232) shows a fake placeholder address/phone/email.
- `STAFF` (line 38) is defined but never rendered anywhere — see Open decisions below.
- `EVENTS` (line 31) and `BOOK_CLUBS` (line 906) are hardcoded placeholder data, see Content features above.

## Open decisions (not code — need a team call before building)

- **Events scope** — see `src/lib/events.ts`'s PROPOSAL comment.
- **Who sends the login emails.** Passwordless means an email on *every* login. Supabase's built-in sender is rate-limited to a handful per hour and is explicitly not for production, so this needs a real SMTP provider (Resend, SendGrid, similar) with a verified sending domain. The project owner is setting this up directly (needs `saisevasadan.org` DNS access) — not a task for the team, just flagging why login emails won't work until it's done.
- **`STAFF` array in `App.tsx` (line 38).** Either build the "meet the team" section it implies, or delete it.
- **Cover art source.** Retry Google Books (and actually read the error this time) vs. switch approach entirely.
- **Per-book reviews/ratings shown on the site.** The reviews feature actually built (see Content features above) is a general feedback form, not this — an Amazon-style rating + review shown on each book's page, with a real `book_id` → `reviews` one-to-many relationship, is a bigger idea that was deliberately scoped down for now. Revisit if the simple version turns out to not be enough.
- **Category data cleanup.** Real `category` values have typo duplicates (e.g. `Books by N Kasturi` / `N.Kasturi` / `N. Kasuri` are one category spelled three ways), five books have no category at all, and `CATEGORIES` in `App.tsx:29` is still Figma placeholder data that matches none of them. This is a one-time data fix in Supabase, not a code task — project owner is handling the data side; `CATEGORIES` in `App.tsx` still needs updating to match once it's cleaned up (or better, derived from the real distinct values instead of hardcoded).

## Ground rules

- Don't touch `App.tsx` wiring for a feature until its stub is actually implemented and tested against real Supabase data — half-wired features break the page for everyone else on `main`.
- RLS is on for every table. If a query silently returns nothing instead of erroring, check policies before assuming the code is wrong.
- Keep `.env` out of git (it already is). Never commit real Supabase keys anywhere, including in migration files or comments.
- **For anything marked "discuss before coding"** (a new data source, a new scraping job, a schema design for a brand-new feature) — bring your planned approach to the project owner before writing implementation code, not after. A `TODO`/`PROPOSAL` comment in a stub file is a starting point for that conversation, not a finalized spec to build against silently.
- **Every PR updates [`CHANGELOG.md`](../CHANGELOG.md)** under `[Unreleased]` — CI fails the PR otherwise. See [GIT_WORKFLOW.md](GIT_WORKFLOW.md) step 5.
