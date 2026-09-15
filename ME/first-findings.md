# SSS Library — First Findings Report

_Analysis date: 2026-08-07_

## 1. Broken / incomplete things in the app

| Item | Location | State |
|---|---|---|
| "Submit Hold Requests" button | [App.tsx:273](src/App.tsx#L273) | No `onClick` at all — dead button. Backend (`checkouts.ts`) is fully implemented and live, just unwired. |
| Cart | App.tsx ~1290 | Tracks `book.id`, but reservations need a specific *copy* (`full_label`). Needs a "pick first available copy" decision before it can call `reserveCopy()`. |
| Contact footer | [App.tsx:1230](src/App.tsx#L1230) | Shows fake placeholder address/phone. Real data already sits unused in `siteInfo.ts`. |
| `STAFF` array | [App.tsx:38](src/App.tsx#L38) | Defined, never rendered anywhere. Open decision, not a bug. |
| `CATEGORIES` | [App.tsx:29](src/App.tsx#L29) | Figma placeholder (`Fiction`/`Non-Fiction`) that matches none of the real book categories. |
| `EVENTS` / `BOOK_CLUBS` | App.tsx:31, 906 | Hardcoded placeholder arrays, not backed by any table yet. |
| Volunteer + donation forms | `AboutPage` | Both just flip local React state and throw away what was typed — nothing is saved anywhere. |
| Book cover art | `bookCovers.ts` | Always shows a 📖 placeholder — a Google Books API attempt was abandoned mid-debug, cause unknown (bad query? CORS? rate limit?). |
| Auth / login | `auth.ts`, `LoginModal` | Entirely stubbed — every function throws "not implemented." `LoginModal` currently fakes a login and accepts any typed name; it also still has a "Library Card Number" field with **no backing data anywhere in the database** — that field needs deleting, not implementing. |
| `thought_of_the_day` | table exists | Empty. Table + read policy exist, but no scrape job writes to it yet, and nothing in `App.tsx` displays it. |

## 2. Admin-side setup — things only the project owner can do (outside the code)

**Branch protection isn't actually available on this repo right now.** Checked directly against GitHub's API — this is a **private** repo, and it returned: *"Upgrade to GitHub Pro or make this repository public to enable this feature."* Concretely, right now **all 7 collaborators (heysaik, sstadi1357, premad809, ashkast24, nihadanal, srisvadlamuri-sudo, Janani108) have push access to `main`** — nothing technically stops any of them from pushing straight to main or merging their own PR unreviewed. The only thing enforcing "PR + review first" today is the written instruction in `GIT_WORKFLOW.md` — a convention, not a rule. Options:
- Pay for GitHub Pro (~$4/mo) → unlocks branch protection on this private repo.
- Make the repo public → branch protection is free, but the code becomes world-readable (no secrets are in it, so this is a "would you rather," not a security hole).
- Leave it as convention-only and rely on trust for now.

**Other things worth confirming are actually done, not just documented:**
- **SMTP for login emails** — docs say *"the project owner is setting this up directly (needs saisevasadan.org DNS access)."* Login is completely blocked without it (Supabase's built-in mailer is rate-limited, not for production). Has this been started?
- **`staff` table is empty** — until at least one row is inserted via the Supabase Table Editor, `is_staff()` returns false for everyone, and `return_book()` can't be called by anyone.
- **Category data cleanup** — docs say the project owner is handling this directly (typo-duplicate categories, 5 uncategorized books). `CATEGORIES` in App.tsx is blocked on this being done.
- **No deployment found** — no Vercel/Netlify config or deploy step in `.github/workflows/` (only the changelog-check exists). There's a stale local `dist/` build from Aug 7, but nothing indicates the site is actually live anywhere yet. Worth deciding hosting before there's a real link to hand out.

## 3. Database architecture — how it's built, how the team should work with it

The RLS pattern already established (and consistently followed across all 3 migrations) is:
- **Public tables** (`books`, `copies`, `thought_of_the_day`): open `select` to `anon`+`authenticated`, no client-side writes.
- **User-owned tables** (`checkouts`): `authenticated` can `select`/`insert` only their own rows (`auth.uid() = user_id`).
- **Sensitive actions** (reserve/checkout/return): not raw table writes — `security definer` Postgres functions that do the availability check and the write in one atomic statement, so two people can't grab the same copy in a race.
- **`staff`**: no insert/update/delete policy *at all* — the only way to grant staff is the project owner, directly, via the Table Editor or SQL Editor. Deliberate, not an oversight.

**The gap**: migrations are plain `.sql` files in `supabase/migrations/`, and a teammate can write a new one as part of a PR — but nothing in the docs says *who actually runs it against the live database* after that PR merges. Right now that's presumably still the project owner, by hand. Worth deciding explicitly (e.g., "migrations get applied by whoever has Supabase project owner access, after the PR is merged") so it doesn't become a silent bottleneck once more people are contributing schema changes.

Separately from GitHub: Supabase's own **Organization → Team** invite lets teammates get dashboard access (e.g. a "Developer" role — can read/write data, can't touch billing) without ever handing out the `service_role` key, which should stay with the project owner alone. (The `service_role` key bypasses Row Level Security entirely — full read/write to everything, no restrictions — and should never go in client code, `.env` in git, or anyone's hands who doesn't need full unrestricted DB access.)

## 4. Stubs that are too high-level to hand someone to build

- **`events.ts`** — literally marked `PROPOSAL`, not decided (drop calendar entirely + link out, vs. actually pull in Google Calendar). Connects to open questions about timings/calendar features — needs a decision first.
- **`thoughtForTheDay.ts`** — table exists, but *where the scrape job runs* (Edge Function+cron vs. GitHub Action vs. external) is still undecided.
- **`bookCovers.ts`** — not a design decision, just needs someone to actually read the failed API response and debug it.
- **`bookClub.ts`, `volunteers.ts`, `donations.ts`** — by contrast, these are *not* too high-level — schema and RLS shape are already fully spec'd in the TODO comments, ready to build as-is.

None of the newer feature ideas discussed (reviews/comments, community book entry, accessibility, location/timing info, access tiers) exist anywhere in the stubs yet — those need the same "flesh out before building" treatment `events.ts` already got, before they can become real tasks for the team.
