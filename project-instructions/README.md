# What needs to be built

This is the task list for the group. Everything backend-facing is already stubbed out in `src/lib/` with a `TODO(team)` comment describing the expected table shape and approach — nothing here needs to be designed from scratch, just built out.

Before picking something up: read [GIT_WORKFLOW.md](GIT_WORKFLOW.md) in this same folder — how we branch, commit, and open PRs.

## Checklist

> **Start here: [`src/lib/checkouts.ts`](../src/lib/checkouts.ts).** Auth is done, which unblocks it — the three Postgres functions it wraps are already live and race-safe, so this is UI wiring rather than new backend. Details in the Checkout flow section below.
>
> Before real members can use any of it, though, **login codes still land in spam** — see Open decisions. That's the project owner's DNS, not a code task.

### Core catalog
- [x] [`src/lib/books.ts`](../src/lib/books.ts) — **done.** `fetchBooks()` reads `books` + `copies`, paged so it can't silently truncate, nullable columns coalesced, and cached in `localStorage` for five minutes. Availability is an allowlist on `status = 'available'`; copies marked `lost`/`damaged`/`withdrawn` count toward neither total nor available.
- [x] [`src/lib/auth.ts`](../src/lib/auth.ts) — **done.** All five functions are implemented and `LoginModal` is a two-step email → code form; `App` holds a `Patron` from `onAuthChange()` rather than a typed-in name, and the nav button signs out when you're already signed in. `signOut()` clears the catalog cache, since availability counts read during a session shouldn't outlive it.

  **It works but isn't usable by members yet: codes land in spam.** See Open decisions — that needs DNS records on `saisevasadan.org`, not code. Test with your own address and check the spam folder.

  Still worth doing on top: a "check your spam folder" line on the code step, and a resend button with a cooldown (Supabase rate-limits repeat sends to the same address). Reference for the original design — `requestSignInCode()` / `verifySignInCode()` / `signOut()` / `getCurrentPatron()` / `onAuthChange()` via Supabase Auth. All five are stubbed with step-by-step `TODO(team)` comments naming the exact Supabase calls; start there. **Decided: authentication is by email, with no password.** The patron types their email, Supabase emails them a six-digit code, they type it back (`signInWithOtp`, then `verifyOtp`). Prefer the code over a magic link — on phones a link often opens in a different browser than the one that asked for it, and the session lands in the wrong place.

  Two reasons for no password: people use a library site a few times a year, which is exactly when passwords get forgotten, and every forgotten one becomes a support request to a volunteer.

  **Library cards are not part of this — remove them.** `LoginModal` asks for a "Library Card Number" and `Patron` carries a `cardId`, but both are Figma mockup leftovers: no card number exists anywhere in the database, and the center doesn't appear to issue cards at all. A card number couldn't be a credential regardless — it's printed on the card and readable by anyone at the desk, so it identifies you without proving anything. Drop the field from `LoginModal` and `cardId` from `Patron` as part of this task.

  The stub previously offered a custom `patrons` table keyed by card number as an alternative to Supabase Auth. That option is closed and has been removed: the migration is already live and hardwired to Supabase Auth — `checkouts.user_id` is a foreign key to `auth.users(id)`, every RLS policy is written against `auth.uid()`, and all three checkout functions are granted to the `authenticated` role. Building a custom table would mean rewriting working, race-safe SQL.

  `LoginModal` currently fakes a login in local state and accepts any name typed into it. Point its `onLogin` callback at `signIn()`; the form becomes email → code, and the patron's display name comes from their account rather than being typed at login. Note that supabase-js persists the session and refreshes tokens on its own, so `getCurrentPatron()` should read `supabase.auth.getSession()` and subscribe to `onAuthStateChange` rather than being a one-shot fetch — otherwise the UI won't notice a sign-out in another tab.

  **Decided: signup is open** (`shouldCreateUser: true` in `signInWithOtp`) — anyone with an email can register and place holds, no member list to pre-load. Abuse isn't prevented up front; it's handled after the fact by staff, who can now be identified via the `staff` table (`is_staff()`, `supabase/migrations/0002_staff_role_and_returns.sql`) — there's no admin UI for cancelling a hold yet, but the pieces to build one exist.

  #### The email side already works — this is now pure wiring

  Custom SMTP is configured on the project and the whole flow is verified end to end **without any app code**, using the two REST endpoints `signInWithOtp` and `verifyOtp` wrap. `POST /auth/v1/otp` returns `200` and a six-digit code arrives; `POST /auth/v1/verify` exchanges that code for an `access_token`. So there is no unknown left in the backend — `auth.ts` is wiring around calls that are known to work.

  You can re-run either at any time to separate "my code is wrong" from "the backend is broken", which is worth doing before debugging React:

  ```bash
  # send a code
  curl -X POST 'https://<project>.supabase.co/auth/v1/otp' \
    -H 'apikey: <publishable key from .env>' -H 'Content-Type: application/json' \
    -d '{"email":"you@example.com","create_user":true}'

  # exchange it for a session
  curl -X POST 'https://<project>.supabase.co/auth/v1/verify' \
    -H 'apikey: <publishable key from .env>' -H 'Content-Type: application/json' \
    -d '{"type":"email","email":"you@example.com","token":"123456"}'
  ```

  Two things to know while working on this:

  - **Codes currently land in spam.** Mail is going out through a Gmail account, which has no DKIM signature on a domain the center owns and no sending reputation for transactional mail, so Gmail filters it. Fine for development — check your spam folder — but it means login is effectively broken for real members until the sending domain is sorted. See Open decisions.
  - **The `Magic Link` email template is what `signInWithOtp` sends.** Supabase's default contains `{{ .ConfirmationURL }}`, a clickable link. For the code flow the template has to include `{{ .Token }}`, otherwise patrons receive a link and there's nothing to type into the form.

  Whatever the login screen ends up looking like, **tell people to check their spam folder** on the "we've sent you a code" step. Cheap, and it's the difference between a confused member and a support request.

### Checkout flow
- [x] [`src/lib/checkouts.ts`](../src/lib/checkouts.ts) — **done.** Cart holds are wired (`reserveCopy()`/`releaseReservation()`, 5-minute hold on adding to cart — see `submitHoldRequests()` in `App.tsx`), checkout converts a hold into a real checkout, and a patron can see what they have out via the account/activity page (`my_active_checkouts()`/`my_checkout_history()`, `0008_patron_holds_and_loans.sql`). Two real bugs were found and fixed along the way, both worth knowing about if you're touching this code: the incomplete-profile prompt at checkout used to render invisibly behind the cart overlay (now a dismissible modal), and `staff_return_book()` had a PL/pgSQL gotcha — a `RETURNS TABLE` column name (`full_label`) collided with the same-named table column, making every return fail with a `42702 ambiguous column` error (fixed in migration `0025`; worth remembering if you ever name a `RETURNS TABLE` column the same as a column you `UPDATE`/`SELECT` inside the function body).
- [x] **Staff returns UI** — **done.** `/staff/returns` (`StaffReturnsPage` in `App.tsx`) lists open checkouts and active holds with a "Mark Returned"/"Release Hold" button per row, wired to `staff_return_book()`/`staff_release_reservation()` (`0009_staff_dashboard_rpcs.sql`, `0018_restore_page_views_and_staff_rpcs.sql`).

### Content features (each needs a new table — schemas are sketched in the TODO comments)
- [ ] [`src/lib/events.ts`](../src/lib/events.ts) — **not decided yet, see the PROPOSAL comment in the file.** Leaning toward dropping calendar-scraping entirely and scoping "events" down to book club sessions only, plus a plain link out to saisevasadan.org/events for everything else. Discuss with the project owner before building either direction. Replaces the hardcoded `EVENTS` array (App.tsx:31).
- [ ] [`src/lib/bookClub.ts`](../src/lib/bookClub.ts) — `fetchBookClubSessions()` / `reserveBookClubSpot()`. Replaces the hardcoded `BOOK_CLUBS` array (App.tsx:906) with real sessions + working RSVP/capacity tracking — same race-condition shape as book checkout, see the TODO for the pattern to reuse.
- [x] [`src/lib/thoughtForTheDay.ts`](../src/lib/thoughtForTheDay.ts) — **done, end to end.** The importer in [`tools/thought-of-the-day/`](../tools/thought-of-the-day/) runs daily and writes to `thought_of_the_day`, `fetchThoughtForTheDay()` reads it, and `ThoughtPage` in `App.tsx` renders it at `/thought`.

  Two things to preserve if you touch it. It shows `quote` (the short highlighted line, ~150–210 chars, ending `– BABA`) rather than `passage`, which is the 1000+ character discourse extract. And it returns the newest row **even when dated tomorrow** — the mail is published on India time and arrives a day ahead, so this is chosen for freshness over strict correctness. That's why the page never says "today's thought": it would contradict the date printed beside it.

  Also note dates are formatted from their parts, not `new Date(iso)` — the latter parses as UTC midnight and renders a day early anywhere west of Greenwich, including here.

  Don't try to scrape the website: `sssmediacentre.org/sai-inspires` renders its content with JavaScript so a plain fetch returns empty placeholders, `archive.sssmediacentre.org` serves a broken TLS certificate chain, and the Google Group archive is private. All three were tested. The email is the only workable source. See [the importer's README](../tools/thought-of-the-day/README.md#reading-it-from-the-frontend) for the full contract.
- [ ] **URLs for individual books** — the four pages have real routes now (`/`, `/catalog`, `/thought`, `/community`), but book detail is still component state, so there's no way to link someone to a book. For a library catalog that's a real gap: no shareable link, and refreshing a book page loses it. Add a `/book/:bookCode` route that looks the code up in the already-loaded `books` array, with sensible loading and not-found states. Small change, deliberately left out of the routing PR to keep it reviewable.
- [x] [`src/lib/volunteers.ts`](../src/lib/volunteers.ts) — **decided: no custom form/table.** Volunteer interest is collected via an external Google Form instead — simpler to maintain for a small team, free spam protection, and a response spreadsheet with no admin UI to build. `AboutPage`'s volunteer section now links out to `VOLUNTEER_FORM_URL` (currently empty — see the TODO in the file for how to create and link the actual form).
- ~~`src/lib/donations.ts`~~ — **removed from V1 scope entirely.** Not being built right now; deferred, not abandoned. The project owner has the original stub + removed UI preserved for later if it comes back.
- [x] [`src/lib/bookCovers.ts`](../src/lib/bookCovers.ts) — **done.** Google Books API (needs `VITE_GOOGLE_BOOKS_API_KEY` — the anonymous/keyless API is flatly disabled, not just rate-limited), with Open Library as a free/keyless fallback for titles Google doesn't index. Enabled everywhere a cover renders (catalog grid, cart, detail page, recommendations, home), gated by `IntersectionObserver` so a big grid doesn't fire every request on page load. Most of this catalog's niche religious-publication titles aren't indexed by either source — the 📖 placeholder is still the common case, and that's a data-availability limit, not a bug to keep chasing.
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

- `EVENTS` and `BOOK_CLUBS` are still hardcoded placeholder data, see Content features above.
- The home page's "Hours" strip is still fake library-opening-hours placeholder data — `WEEKLY_TIMINGS` (`src/lib/siteInfo.ts`) has the real weekly schedule but isn't wired in yet. (`SITE_NAME`/`SITE_ADDRESS`/`MEETING_ROOM` from the same file *are* wired into the contact footer now.)
- No link to the main site (saisevasadan.org) anywhere in the app yet — still just needs a plain `<a>` added somewhere in the footer/nav.
- No `/book/:bookCode` route yet — book detail is still component state (`viewingBook`), so there's still no way to link someone directly to a book or have a refresh survive on that page.

## Open decisions (not code — need a team call before building)

- **Events scope** — see `src/lib/events.ts`'s PROPOSAL comment.
- **Who processes returns, and can patrons do it themselves?** The schema assumes a desk: `return_book()` is staff-only, because it can close *anyone's* loan. But this library is trust-based — patrons take books off the shelf and put them back without staff involved — so an argument exists for letting them close their own loan too. A `return_own_copy()` function (same shape, but with `user_id = auth.uid()` as both the authorisation check and the atomic guard) was drafted and deliberately not merged, because it changes how the library is assumed to operate rather than just adding a screen. Needs the project owner, not a developer.
- **Where login emails send *from*.** Partly settled: custom SMTP is configured and codes do arrive, so the flow is testable today. But mail goes out through a Gmail account, and **codes land in spam** — a consumer Gmail can't carry a DKIM signature for a domain the center owns, and has no reputation for transactional mail. A login code in spam means the member simply can't sign in, so this blocks real use even though it doesn't block development. The fix is a transactional provider (Resend, Brevo, similar) with SPF/DKIM/DMARC on `saisevasadan.org`, which needs DNS access — project owner's, not the team's. Switching later is four fields in the Supabase dashboard and no code change. Sending a code to a [mail-tester.com](https://www.mail-tester.com) address gives a scored breakdown of exactly which records are missing, which is worth having in hand when asking for the DNS changes.
- **Category data cleanup.** Real `category` values have typo duplicates (e.g. `Books by N Kasturi` / `N.Kasturi` / `N. Kasuri` are one category spelled three ways), and some books have no category at all. This is a one-time data fix in Supabase, not a code task — the category filter list is already derived from the real distinct values (not hardcoded anymore), so it'll reflect the cleanup automatically once the data's fixed.

*(Resolved since this list was written: staff can now see everyone's loans — `0007_staff_view_policies.sql` added the missing policy, and the Returns & Holds page uses it. Cover art source was settled — Google Books + Open Library, see Content features above. Per-book reviews shown on the site were also built — `reviews` table, `/staff/reviews`, one table covers both book-specific and general library reviews. There used to be a leftover `STAFF` array in `App.tsx` from the original mockup; it's gone now.)*

## Ground rules

- Don't touch `App.tsx` wiring for a feature until its stub is actually implemented and tested against real Supabase data — half-wired features break the page for everyone else on `main`.
- RLS is on for every table. If a query silently returns nothing instead of erroring, check policies before assuming the code is wrong.
- Keep `.env` out of git (it already is). Never commit real Supabase keys anywhere, including in migration files or comments.
- **For anything marked "discuss before coding"** (a new data source, a new scraping job, a schema design for a brand-new feature) — bring your planned approach to the project owner before writing implementation code, not after. A `TODO`/`PROPOSAL` comment in a stub file is a starting point for that conversation, not a finalized spec to build against silently.
- **Every PR updates [`CHANGELOG.md`](../CHANGELOG.md)** under `[Unreleased]` — CI fails the PR otherwise. See [GIT_WORKFLOW.md](GIT_WORKFLOW.md) step 5.
