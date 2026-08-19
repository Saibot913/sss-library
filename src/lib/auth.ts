import { invalidateBooksCache } from './books'
import { supabase } from './supabaseClient'

export const AUTH_REDIRECT_PATH = '/profile'

export type Patron = {
  id: string
  email: string
  name: string
  firstName: string
  lastName: string
  phone: string
}

type ProfileRow = {
  id: string
  email?: string | null
  first_name?: string | null
  last_name?: string | null
  phone?: string | null
}

type SupabaseUserLike = {
  id?: string
  email?: string | null
  user_metadata?: {
    first_name?: string | null
    last_name?: string | null
    phone?: string | null
  } | null
}

async function fetchProfileForUser(userId: string, email?: string | null): Promise<ProfileRow | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, first_name, last_name, phone')
    .eq('id', userId)
    .maybeSingle()

  if (error && error.code !== 'PGRST116') throw error
  if (data) return data

  if (!email) return null

  const { data: byEmail, error: emailError } = await supabase
    .from('profiles')
    .select('id, email, first_name, last_name, phone')
    .eq('email', email.toLowerCase())
    .maybeSingle()

  if (emailError && emailError.code !== 'PGRST116') throw emailError
  return byEmail
}

function toPatron(user: unknown, profile?: ProfileRow | null): Patron {
  const typedUser = user as SupabaseUserLike
  const email = typedUser?.email ?? profile?.email ?? ''
  const firstName = profile?.first_name?.trim() ?? typedUser?.user_metadata?.first_name?.trim() ?? ''
  const lastName = profile?.last_name?.trim() ?? typedUser?.user_metadata?.last_name?.trim() ?? ''
  const phone = profile?.phone?.trim() ?? typedUser?.user_metadata?.phone?.trim() ?? ''
  const displayName = [firstName, lastName].filter(Boolean).join(' ')

  return {
    id: typedUser?.id ?? profile?.id ?? '',
    email,
    name: displayName || email.split('@')[0] || 'Library member',
    firstName,
    lastName,
    phone,
  }
}

export async function requestSignInCode(email: string, mode: 'login' | 'signup' = 'login'): Promise<void> {
  const normalizedEmail = email.trim()
  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/auth-email`, {
    method: 'POST',
    headers: {
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email: normalizedEmail, mode }),
  })

  const result = await response.json() as { error?: string }
  if (!response.ok) throw new Error(result.error ?? 'We could not send your sign-in email.')
}

export async function verifySignInCode(_email: string, _code: string): Promise<Patron> {
  throw new Error('This app uses email magic links instead of one-time codes.')
}

export async function updatePatronProfile(input: { email: string; firstName: string; lastName: string; phone: string }): Promise<Patron> {
  const normalized = {
    email: input.email.trim().toLowerCase(),
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    phone: input.phone.trim(),
  }

  if (!normalized.email) throw new Error('Please enter your email address.')

  const { data: currentSession } = await supabase.auth.getSession()
  const currentEmail = currentSession.session?.user.email?.toLowerCase() ?? ''
  const emailChanged = normalized.email !== currentEmail

  const { data, error } = await supabase.auth.updateUser({
    ...(emailChanged ? { email: normalized.email } : {}),
    data: {
      first_name: normalized.firstName,
      last_name: normalized.lastName,
      phone: normalized.phone,
    },
  })

  if (error) throw error
  if (!data.user) throw new Error('No user returned after saving your profile.')

  const profilePayload = {
    id: data.user.id,
    email: (data.user.email ?? '').toLowerCase(),
    first_name: normalized.firstName,
    last_name: normalized.lastName,
    phone: normalized.phone,
  }

  const { error: profileError } = await supabase
    .from('profiles')
    .upsert(profilePayload, { onConflict: 'id' })

  if (profileError) throw profileError

  return toPatron(data.user, profilePayload)
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
  invalidateBooksCache()
}

export async function deleteAccount(): Promise<void> {
  const { data } = await supabase.auth.getSession()
  const accessToken = data.session?.access_token
  if (!accessToken) throw new Error('You must be signed in to delete your account.')

  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-account`, {
    method: 'POST',
    headers: {
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  })
  const result = await response.json() as { error?: string }
  if (!response.ok) throw new Error(result.error ?? 'We could not delete your account.')

  await supabase.auth.signOut()
  invalidateBooksCache()
}

export async function getCurrentPatron(): Promise<Patron | null> {
  const { data } = await supabase.auth.getSession()
  if (!data.session?.user) return null

  const profile = await fetchProfileForUser(data.session.user.id, data.session.user.email)
  return toPatron(data.session.user, profile)
}

export function onAuthChange(handler: (patron: Patron | null) => void): () => void {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    if (!session) {
      handler(null)
      return
    }

    window.setTimeout(() => {
      fetchProfileForUser(session.user.id, session.user.email)
        .then(profile => handler(toPatron(session.user, profile)))
        .catch(() => handler(toPatron(session.user)))
    }, 0)
  })

  return () => {
    data.subscription.unsubscribe()
  }
}
