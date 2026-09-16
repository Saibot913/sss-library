# Handoff / TODO — as of 2026-09-16

Session picked up staff pages + a production drift crisis + a reviews feature.
This file is the "pick up where we left off" doc. Untracked/local like the rest of `ME/`.

## 🔴 Open bug — checkout still reportedly broken

**Status: NOT resolved, needs fresh investigation.** User reported "Check Out" does nothing
when clicking it in the cart drawer. One real bug was found and fixed (PR #23, not yet
merged): `submitHoldRequests()` in `src/App.tsx` showed `ProfilePage` or `LoginModal` when
the patron's profile was incomplete / not signed in, but never closed the cart drawer first
— the cart is a full-screen `position: fixed` overlay (`zIndex: 200`) that stayed on top,
so the form rendered invisible behind it. Fix: `setShowCart(false)` added to both branches
in `submitHoldRequests()`.

**After that fix was hot-reloaded live, the user said it still doesn't seem to work.**
Not yet diagnosed further. Next session should:
1. Get the browser console open and actually reproduce it — get the real error message or
   confirm nothing errors at all (silent no-op vs. thrown exception are different bugs).
2. Confirm whether the reporter's patron account actually *has* a complete profile — if
   `hasProfile` is already `true`, the fix in #23 wouldn't touch their case at all, and the
   real bug is somewhere in the `checkoutBook()` loop itself (lines ~3130–3145 in `App.tsx`),
   not the profile-form-visibility issue.
3. Check `checkoutBook()` in `src/lib/checkouts.ts` and the `checkout_book` RPC
   (`0001_checkouts_and_reservations.sql`) actually still work end-to-end — confirmed to
   exist live earlier this session, but existing ≠ working correctly.
4. Rule out stale state: the dev server survived many file edits + branch switches this
   session; a hard refresh (Cmd+Shift+R) should be step zero before assuming a real bug.

**Git state left mid-investigation:** the local working directory is currently checked out
on branch `surya-fix-checkout-hidden-profile-form` (PR #23), NOT `main` — this was
deliberate, to keep the fix live on the running dev server for testing. Next session:
check `git branch --show-current` before doing anything branch-related. PR #23 itself is
open, checks untested/unconfirmed, not merged.

## Blocked items (need something from you before I can proceed)

- **Book cover art**: code path is ready to build (`src/lib/bookCovers.ts`), but blocked on
  a free Google Cloud API key with the Books API enabled — confirmed earlier this session
  that Google fully blocks keyless requests (`429`, `quota_limit_value: 0`), not a bug in
  our code. Once you have a key, drop it in `.env` and say so.
- **Reviews & Volunteer Google Forms**: `REVIEW_FORM_URL` (`src/lib/reviews.ts`) and
  `VOLUNTEER_FORM_URL` (`src/lib/volunteers.ts`) are both still empty strings — the actual
  forms were never created. Setup instructions are written out as comments in both files
  (reviews.ts's now includes the Category-dropdown-with-conditional-title-field design from
  this session). Needs your org's Google account.

## Deploy readiness — still not launch-ready even though features are close to MVP

- No hosting/deploy config exists (no Vercel/Netlify config, no deploy step in
  `.github/workflows/`).
- Auth emails still route through a personal Gmail SMTP relay — codes land in spam,
  unblocks dev but not real patrons.
- Confirm (admin-side, not code): category data cleanup done, `staff` table has the right
  people (currently: `[redacted]`, `[redacted]`).

## What's actually done and live in production (through today)

Everything below is merged to `main` and its migrations pushed to Supabase (through
migration `0019`):
- Staff schema drift reconciled (`staff` table is email-keyed, `is_staff()` matches)
- Dropped genuinely-dead `staff_dashboard()`/`staff_inventory()`/old `page_views` attempt,
  then **had to restore `page_views`** after discovering it wasn't actually dead — a
  separate, undocumented `staff_analytics()`/`record_page_view()` system depended on it.
  See migration `0018` and the "two overlapping analytics systems" note below.
- `add_book`/`add_copy`/`update_book`/`update_copy` RPCs + a combined "Manage Books" staff
  page (Add + Edit on one page, per your explicit request)
- Returns & Holds staff page
- Staff Dashboard page (`staff_dashboard_stats` + `staff_dashboard_extra`)
- Self-service "Manage Staff" page — any staff can add/remove other staff (your explicit
  tradeoff request), with guardrails against self-removal and removing the last staff member
- Staff nav consolidated into one "Staff" hub page (`/staff`) with a box per staff page,
  each page linking back via a shared back-link — replaces the old one-button-per-page menu
- Per-book and library reviews (`reviews` table, nullable `book_code`), staff-curated via
  `/staff/reviews`, manual entry from the Google Sheet (no Sheets API integration — decided
  against to avoid new external credentials)
- CORS fix for `auth-email`/`delete-account` Edge Functions so local dev / Conductor
  workspaces on arbitrary ports aren't blocked
- Swami quotes expanded to 15, rotating hourly

## One open decision, not urgent, not forgotten

`staff_analytics()`/`record_page_view()` (dormant, no UI) and `staff_dashboard_stats()`/
`staff_dashboard_extra()` (live, has UI) are two separate, overlapping analytics systems.
Worth reconciling into one eventually — real product call, not a bug, no rush.
