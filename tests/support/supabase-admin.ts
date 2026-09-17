import { createClient } from '@supabase/supabase-js'
import { config as dotenvConfig } from 'dotenv'
import path from 'node:path'

// Loaded here (not just in playwright.config.ts) because this module is also
// imported by tests/support/seed-test-accounts.ts, which runs standalone via
// `node`, outside Playwright's config bootstrap.
const root = path.resolve(import.meta.dirname, '../..')
dotenvConfig({ path: path.resolve(root, '.env') })
dotenvConfig({ path: path.resolve(root, 'tests/.env') })

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required env var ${name} - see tests/README.md and tests/.env.example`)
  }
  return value
}

/**
 * Service-role client. Server-side only (Node test process) - the key this
 * reads (SUPABASE_SERVICE_ROLE_KEY) must never be exposed to a browser
 * context or committed anywhere; it lives in tests/.env (gitignored) locally
 * and as a CI secret.
 */
export function createAdminClient() {
  const url = requireEnv('VITE_SUPABASE_URL')
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
}

/** Anon client, for exchanging a magic-link token_hash the same way the real app's client would. */
export function createAnonClient() {
  const url = requireEnv('VITE_SUPABASE_URL')
  const anonKey = requireEnv('VITE_SUPABASE_PUBLISHABLE_KEY')
  return createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } })
}

export function testPatronEmail(): string {
  return requireEnv('TEST_PATRON_EMAIL')
}

export function testStaffEmail(): string {
  return requireEnv('TEST_STAFF_EMAIL')
}
