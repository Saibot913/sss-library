# Handoff / TODO — as of 2026-09-17

Tracked in git, like the rest of `planning_docs/` — visible to anyone who clones the repo,
not just local scratch notes. Replaces the previous version of this file, which described
the checkout bug as unresolved and book covers as blocked — both are done now.

## What's actually done and live in production (through today)

Everything below is merged to `main` and its migrations pushed to Supabase (through
migration `0025`):

- **Checkout**, fully working end-to-end. Two separate bugs were found and fixed: the cart
  drawer wasn't closing before showing the profile/login form (PR #23), and the
  incomplete-profile prompt itself rendered in normal document flow instead of as an
  overlay, so it could land off-screen depending on scroll position — now a dismissible
  fixed-overlay modal (patrons can close it and keep browsing; checkout just stays blocked
  until the profile is complete).
- **Returns**, fully working. `staff_return_book()` had a real SQL bug (`42702` ambiguous
  column — `RETURNS TABLE` implicitly declares `full_label` as a PL/pgSQL variable, colliding
  with the table column of the same name in the function's own `WHERE` clauses) that made
  every "Mark Returned" click fail silently since the function was introduced. Fixed in
  migration `0025`.
- **Book cover art**, live catalog-wide (not just the detail page) — Google Books API first,
  Open Library as a free/keyless fallback for titles Google doesn't have, gated by
  `IntersectionObserver` so a 100+ book grid doesn't fire every request at once, deduped
  against React StrictMode double-mounting, and careful to not permanently cache a transient
  `429`/`5xx` failure as "confirmed no cover" (that bug caused "some books stopped loading"
  after a scroll burst — fixed). Neither source indexes most of this catalog's niche
  religious-publication titles, so the 📖 placeholder is still the common case — that's a
  data-availability limit, not a bug.
- **Waitlist** — "Join Waitlist" on a book's detail page once every copy is checked out,
  reusing the signed-in patron's existing profile rather than a new form.
- **Book title editing** — `update_book()` originally excluded `title` on purpose; that
  turned out to be annoying in practice, so it's editable from Manage Books now (migration
  `0023`).
- Staff `Returns & Holds` page actually loads (`staff_list_checkouts()` had its own
  structurally different bug — a `timestamp`/`timestamptz` type mismatch causing every call
  to 400 since it was introduced — fixed in migration `0021`; patron name concatenation was
  also missing a space, migration `0022`).
- Cart hold duration back down to 5 minutes (was bumped to 30, turned out too long).
- Multiple UI/legibility passes: nav active-tab highlighting, a "Staff" top-nav tab, catalog
  grid sizing and divider rendering, several rounds of font-size floors, Thought for the Day
  unicode entity decoding, and more — see `CHANGELOG.md` under `[Unreleased]` for the full,
  precise list; this file only summarizes.
- BMAD Method tooling trimmed and tracked in git — only the 4 skills the repo's own review
  instructions actually call (`bmad-code-review`, `bmad-testarch-test-review`,
  `bmad-testarch-nfr`, `bmad-help`), not the full ~40-skill install, so those instructions
  actually work wherever the review runs instead of only on one machine.

## Blocked items (need something from you before I can proceed)

- **Reviews & Volunteer Google Forms** (PR #30, `surya-community-forms`, intentionally left
  open): `REVIEW_FORM_URL` (`src/lib/reviews.ts`) and `VOLUNTEER_FORM_URL`
  (`src/lib/volunteers.ts`) are both still empty strings — the actual Google Forms were never
  created. The input-box UI itself is built; it just isn't wired to a real submission
  destination yet. Needs your org's Google account to create the forms, then drop the URLs
  in and merge.

## Deploy readiness — still not launch-ready even though features are close to MVP

- No hosting/deploy config exists (no Vercel/Netlify config, no deploy step in
  `.github/workflows/`).
- Auth emails still route through a personal Gmail SMTP relay — codes land in spam,
  unblocks dev but not real patrons.
- Confirm (admin-side, not code): category data cleanup done, `staff` table has the right
  people (currently: `[redacted]`, `[redacted]`).

## Open, not urgent

- `staff_analytics()`/`record_page_view()` (dormant, no UI) and `staff_dashboard_stats()`/
  `staff_dashboard_extra()` (live, has UI) are two separate, overlapping analytics systems.
  Worth reconciling into one eventually — real product call, not a bug, no rush.
- A staff member force-releasing a patron's cart hold from the Returns & Holds page doesn't
  update that patron's own browser — their cart is pure client-side in-memory state with no
  server-sync mechanism, so it only catches up if they try to check out (which then correctly
  fails) or reload. Fixable with a Supabase Realtime subscription on `copies` (free tier
  covers this easily — 200 concurrent connections, 2M messages/month, nowhere near what this
  app would use) — not yet built, low priority since checkout still fails safely.
