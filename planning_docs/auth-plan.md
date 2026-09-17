# Auth — the real plan, explained

Everything below is *already decided* (in `project-instructions/README.md` and the comments in `src/lib/auth.ts`) — nothing here is new. This doc just pulls it into one place with plain-language explanation, since it's the one feature where "what Supabase actually does" isn't obvious from reading the stub.

## The end-to-end flow, in order

1. **Visitor types their email** into what's currently `LoginModal` (just cleaned up to drop the fake "Library Card Number" field — still fake otherwise: it takes a typed name and pretends that's a login).
2. **Site asks Supabase to email a 6-digit code** to that address. This is one line: `supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } })`. `shouldCreateUser: true` means: if this email has never signed in before, Supabase silently creates an account for it right now — there's no separate "sign up" screen anywhere, ever. First-timers and returning patrons type the exact same thing.
3. **Visitor gets an email, types the 6-digit code back in.** Site exchanges it for a real login: `supabase.auth.verifyOtp({ email, token: code, type: 'email' })`. If the code's right, Supabase hands back a **session** (an access token + refresh token).
4. **supabase-js stores that session in the browser automatically** (`localStorage`, under the hood) and silently refreshes the token before it expires. Nothing in the app has to manually pass a token around ever again — every later `supabase.rpc(...)` or `supabase.from(...)` call just carries it for you.
5. **The database now knows who's asking**, via a built-in Postgres function `auth.uid()` that reads whoever the current session belongs to. That's what every RLS policy and function is written against — e.g. `reserve_copy()` in `0001_checkouts_and_reservations.sql` does `reserved_by = auth.uid()`. The frontend never sends a user id explicitly; the database derives it from the session on its own.

## Where the account actually lives

There's no custom `users` or `patrons` table. Step 2 above creates a row directly in `auth.users` — a table Supabase's Auth system manages for you, not one anyone in this project created. Every table that needs to reference "which patron" points a foreign key at `auth.users(id)`:
- `checkouts.user_id`
- `staff.user_id`
- `copies.reserved_by`

That's the whole "database" side of auth — there isn't a separate signup form, a passwords table, or anything to design. It's Supabase's built-in system, used as-is.

## The stub functions (`src/lib/auth.ts`) — what's real vs. what's a placeholder

All five currently `throw new Error('not implemented yet')`. Each one is a thin wrapper around one Supabase call — this isn't a hard feature, it's a short one that was intentionally left for the team rather than a design problem to solve:

| Function | What it should do | The actual call |
|---|---|---|
| `requestSignInCode(email)` | Step 2 above | `supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } })` |
| `verifySignInCode(email, code)` | Step 3 above | `supabase.auth.verifyOtp({ email, token: code, type: 'email' })`, then map the returned user onto a `Patron` |
| `signOut()` | End the session | `supabase.auth.signOut()`, plus clear the books cache (`invalidateBooksCache()`) since availability counts shouldn't outlive the session |
| `getCurrentPatron()` | Read whoever's already logged in, on page load | `supabase.auth.getSession()` — **not** a fresh login attempt, just checking browser storage for an existing one |
| `onAuthChange(handler)` | Keep the UI in sync if the session changes elsewhere | `supabase.auth.onAuthStateChange(...)` — needed because supabase-js refreshes tokens and syncs sign-out across browser tabs on its own; without this the UI can silently drift out of sync (e.g. keep showing someone as logged in after they signed out in another tab) |

One naming gap worth knowing: nothing in `auth.users` has a display name field. `toPatron()` (also unimplemented) needs to invent one — the plan is to fall back to the part of the email before the `@` (e.g. `jane@example.com` → "jane") and let people live with that, since adding a real "display name" field means a whole new profile table just for one string, which wasn't worth it for v1.

## What still needs wiring in `App.tsx` once the above exists

- `LoginModal` (just simplified to drop the card number) still needs its "Full Name" field replaced with an email field, plus a second step for the 6-digit code — it's currently a 1-step fake form, the real thing is 2 steps.
- `loggedIn`/`userName` state in the root `App` component should come from `onAuthChange()` instead of being set directly by the modal.
- Only holds/checkout need a real session — browsing the catalog stays public either way, nothing changes there.

## Not part of this session's work

I didn't implement any of the above — per your instruction, this stays a team task. This file exists so the *plan* is spelled out in one place, not to get ahead of the team building it.
