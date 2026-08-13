import type { User } from '@supabase/supabase-js'
import { invalidateBooksCache } from './books'
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
  /** What they told us to call them; falls back to the email local-part. */
  name: string
  /** Null until they've filled in the profile form at first checkout. */
  phone: string | null
}

// Name and phone live in the auth user's `user_metadata` rather than in a
// `patrons` table, which doesn't exist yet (see the open decision in
// project-instructions/README.md). That's fine for these two fields
// specifically, because they're the patron's own contact details and there's
// no harm in them editing their own name.
//
// It would NOT be fine for anything granting privileges. `user_metadata` is
// writable by the user it belongs to, so a `role: 'staff'` stored here could
// be self-awarded. Staff membership lives in the `staff` table for exactly
// that reason — keep it that way.
function toPatron(user: User): Patron {
  const email = user.email ?? ''
  const meta = (user.user_metadata ?? {}) as { full_name?: unknown; phone?: unknown }
  const name = typeof meta.full_name === 'string' ? meta.full_name.trim() : ''
  const phone = typeof meta.phone === 'string' ? meta.phone.trim() : ''
  return {
    id: user.id,
    email,
    name: name || email.split('@')[0] || email,
    phone: phone || null,
  }
}

/**
 * Save the patron's own name and phone.
 *
 * Fires a USER_UPDATED event, so anything subscribed through onAuthChange()
 * picks up the new name without needing to be told.
 */
export async function updatePatronProfile(name: string, phone: string): Promise<Patron> {
  const { data, error } = await supabase.auth.updateUser({
    data: { full_name: name, phone },
  })
  if (error) throw error
  if (!data.user) throw new Error('Saving your details failed — please try again.')
  return toPatron(data.user)
}

/** Send a six-digit sign-in code. Signup is open (`shouldCreateUser: true`). */
export async function requestSignInCode(email: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  })
  if (error) throw error
}

/** Exchange the emailed code for a session. */
export async function verifySignInCode(email: string, code: string): Promise<Patron> {
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token: code,
    type: 'email',
  })
  if (error) throw error
  if (!data.user) throw new Error('Sign-in failed — no user returned.')
  return toPatron(data.user)
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
  invalidateBooksCache()
}

/** Read the stored session (null when signed out). */
export async function getCurrentPatron(): Promise<Patron | null> {
  const { data } = await supabase.auth.getSession()
  return data.session ? toPatron(data.session.user) : null
}

/** Subscribe to session changes; return unsubscribe for useEffect cleanup. */
export function onAuthChange(handler: (patron: Patron | null) => void): () => void {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    handler(session ? toPatron(session.user) : null)
  })
  return () => data.subscription.unsubscribe()
}
