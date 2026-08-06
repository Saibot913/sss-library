import { supabase } from './supabaseClient'

// Authentication is by email with a one-time code — no passwords, no
// library cards. See project-instructions/README.md for why.
//
// The flow is two steps, which is why there is no single signIn():
//   1. requestSignInCode(email)        -> Supabase emails a 6-digit code
//   2. verifySignInCode(email, code)   -> code is exchanged for a session
//
// Once step 2 succeeds, supabase-js stores the session and attaches it to
// every later request on its own. Nothing else in the app needs to pass a
// token around: the checkout functions in checkouts.ts read auth.uid() on
// the database side and will simply start working.

export type Patron = {
  /** Supabase auth user id (a uuid). This is what checkouts.user_id holds. */
  id: string
  email: string
  /** Display name. See the TODO on toPatron() — there is no source for this yet. */
  name: string
}

// TODO(team): map a Supabase auth user onto a Patron.
//
// `id` and `email` come straight off the user object. `name` has no
// source yet: auth.users has no display name, and there's no `patrons`
// profile table (signup is open — see requestSignInCode below — so
// nothing requires one to exist).
//
// Fall back to the email local-part (the part before '@') and let
// patrons correct it later — that's the cheapest honest option and
// needs no new table. Whatever this returns is what the header greeting
// and hold requests will display.
function toPatron(_user: unknown): Patron {
  throw new Error('toPatron() is not implemented yet — see TODO in src/lib/auth.ts')
}

// TODO(team): send the six-digit code.
//
//   const { error } = await supabase.auth.signInWithOtp({
//     email,
//     options: { shouldCreateUser: true },
//   })
//   if (error) throw error
//
// Decided: signup is open — anyone with an email can register and place
// holds (`shouldCreateUser: true`). Reasoning is in
// project-instructions/README.md. Abuse isn't handled by gating signup;
// it's handled after the fact by staff, who can now identify themselves
// via the `staff` table (`is_staff()` in
// supabase/migrations/0002_staff_role_and_returns.sql) — there's no
// admin UI for cancelling a hold yet, but the pieces exist to build one.
//
// Two things worth handling in the UI rather than discovering in
// production: Supabase rate-limits how often the same address can be
// mailed (so a "resend code" button needs a cooldown), and the code
// expires — the window is configurable in the Supabase dashboard.
//
// This deliberately returns void. Do not leak whether the address exists;
// the UI should say "if that address is registered, a code is on its way"
// either way, or it becomes a way to enumerate members.
export async function requestSignInCode(_email: string): Promise<void> {
  void supabase
  throw new Error('requestSignInCode() is not implemented yet — see TODO in src/lib/auth.ts')
}

// TODO(team): exchange the code for a session.
//
//   const { data, error } = await supabase.auth.verifyOtp({
//     email, token: code, type: 'email',
//   })
//   if (error) throw error
//   return toPatron(data.user)
//
// A wrong or expired code comes back as an error, not as a null user —
// let it propagate so the modal can show "that code didn't work."
export async function verifySignInCode(_email: string, _code: string): Promise<Patron> {
  void toPatron
  throw new Error('verifySignInCode() is not implemented yet — see TODO in src/lib/auth.ts')
}

// TODO(team): `const { error } = await supabase.auth.signOut()` — throw on
// error. Also call invalidateBooksCache() from ./books here: availability
// counts cached during a session shouldn't outlive it.
export async function signOut(): Promise<void> {
  throw new Error('signOut() is not implemented yet — see TODO in src/lib/auth.ts')
}

// TODO(team): read the *stored* session, don't re-authenticate.
//
//   const { data } = await supabase.auth.getSession()
//   return data.session ? toPatron(data.session.user) : null
//
// Returns null when signed out — that's the normal case for a visitor
// browsing the catalog, not an error. Catalog reads are public by policy,
// so nothing should be gated on this except holds and checkout.
export async function getCurrentPatron(): Promise<Patron | null> {
  throw new Error('getCurrentPatron() is not implemented yet — see TODO in src/lib/auth.ts')
}

// TODO(team): subscribe to session changes.
//
//   const { data } = supabase.auth.onAuthStateChange((_event, session) => {
//     handler(session ? toPatron(session.user) : null)
//   })
//   return () => data.subscription.unsubscribe()
//
// This is not optional polish. supabase-js refreshes tokens in the
// background and syncs sign-out across tabs, so a one-shot
// getCurrentPatron() on mount will drift out of step with reality —
// App.tsx would keep showing someone as logged in after their session
// ended elsewhere. Call this from a useEffect and return the unsubscribe
// function as the cleanup.
export function onAuthChange(_handler: (patron: Patron | null) => void): () => void {
  throw new Error('onAuthChange() is not implemented yet — see TODO in src/lib/auth.ts')
}

// TODO(team): wiring checklist for App.tsx, once the above is implemented.
//
//   - LoginModal (App.tsx ~line 145) collects a name and a "Library Card
//     Number" and calls onLogin(name) with neither verified. Replace both
//     fields with a single email field, then a second step for the code.
//     The card number has no counterpart anywhere in the database.
//   - `loggedIn`/`userName` local state (App.tsx ~line 1256) should come
//     from onAuthChange() instead of being set by the modal.
//   - Only holds and checkout need a session. Browsing stays public.
