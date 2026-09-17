import type { Session } from '@supabase/supabase-js'
import { createAdminClient, createAnonClient } from './supabase-admin'

/**
 * Mints a real Supabase session for `email` server-side, without sending an
 * actual email: admin.generateLink() returns a hashed token that the anon
 * client can exchange via verifyOtp() exactly like a patron clicking the
 * real magic-link would. Server-side only - never call this from
 * browser-executed code.
 *
 * generateLink({ type: 'magiclink' }) documents that it creates the user on
 * the fly for a brand-new email, but empirically the token it returns for a
 * user created that way doesn't verify ("Email link is invalid or has
 * expired") - only for an already-existing, already-confirmed user. So this
 * creates the user first (idempotent - a "user already exists" error just
 * means it's already there) and generates the link as a second step.
 *
 * Generating a link invalidates whatever link/token was previously issued
 * for that email, so two tests minting a session for the *same* seeded
 * account (e.g. the patron account, used by several specs) at the same
 * moment can race - the second generateLink() invalidates the token the
 * first is about to verify. CI runs this suite with a single worker (see
 * playwright.config.ts), so this can't happen there; it can happen locally
 * with the default multi-worker run, hence the retry.
 */
export async function mintSessionForEmail(email: string, attempt = 1): Promise<Session> {
  const admin = createAdminClient()
  await admin.auth.admin.createUser({ email, email_confirm: true })

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  })
  if (linkError) throw new Error(`generateLink failed for ${email}: ${linkError.message}`)

  const anon = createAnonClient()
  const { data: verifyData, error: verifyError } = await anon.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: 'magiclink',
  })
  if (verifyError || !verifyData.session) {
    if (attempt < 4) {
      await new Promise(resolve => setTimeout(resolve, 150 * attempt + Math.random() * 150))
      return mintSessionForEmail(email, attempt + 1)
    }
    throw new Error(`verifyOtp failed for ${email}: ${verifyError?.message ?? 'no session returned'}`)
  }

  return verifyData.session
}
