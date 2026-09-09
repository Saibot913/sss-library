import { test as base } from '@playwright/test'
import {
  type AuthFixtures,
  type AuthProvider,
  createAuthFixtures,
  setAuthProvider,
} from '@seontechnologies/playwright-utils/auth-session'
import { getBaseUrl } from './base-url'

// Supabase's browser client persists the session under this localStorage key
// (derived from the project ref in VITE_SUPABASE_URL). See src/lib/supabaseClient.ts.
const SUPABASE_PROJECT_REF = 'gpekfosbyobdffavrumi'
const SUPABASE_STORAGE_KEY = `sb-${SUPABASE_PROJECT_REF}-auth-token`

type StorageOrigin = { origin: string; localStorage?: { name: string; value: string }[] }
type SupabaseStoredSession = { access_token: string; expires_at?: number } // expires_at: unix seconds

function getOrigins(tokenData: Record<string, unknown>): StorageOrigin[] {
  return (tokenData.origins as StorageOrigin[] | undefined) ?? []
}

function parseSupabaseSession(tokenData: Record<string, unknown>): SupabaseStoredSession | null {
  const entry = getOrigins(tokenData)[0]?.localStorage?.find(item => item.name === SUPABASE_STORAGE_KEY)
  if (!entry) return null
  try {
    return JSON.parse(entry.value) as SupabaseStoredSession
  } catch {
    return null
  }
}

const supabaseAuthProvider: AuthProvider = {
  getEnvironment: options => options?.environment ?? 'local',
  getUserIdentifier: options => options?.userIdentifier ?? 'default-user',

  extractToken: tokenData => parseSupabaseSession(tokenData)?.access_token ?? null,

  // Supabase's browser client keeps the session in localStorage, not cookies,
  // so there is nothing to inject here for this project.
  extractCookies: () => [],

  // The actual mechanism for this app: write the session back into
  // localStorage so it's present before the app's first script runs.
  extractStorage: tokenData => getOrigins(tokenData).map(o => ({ origin: o.origin, localStorage: o.localStorage ?? [] })),

  // rawToken here is whatever extractToken returned (the JWT string itself),
  // which carries no expiry info we bother decoding. This path is never
  // exercised today since manageAuthToken (below) is unimplemented.
  isTokenExpired: rawToken => !rawToken,

  // TODO: this app signs patrons in via a Supabase magic-link email
  // (src/lib/auth.ts requestSignInCode -> the auth-email Edge Function), which
  // has no password/API grant a test runner can drive directly. Minting a
  // session here needs one of:
  //   - a Supabase service-role admin call (supabase.auth.admin.generateLink /
  //     admin.createUser) run against a dedicated test account, OR
  //   - a test-only Edge Function that exchanges a shared secret for a session.
  // The service-role key must never live in this repo or a local .env (see
  // README.md #10) - it belongs in a CI secret / local-only file this
  // provider reads at runtime. Left unimplemented until that decision is
  // made; reported as a deviation in the framework setup summary.
  manageAuthToken: async () => {
    throw new Error(
      'supabaseAuthProvider.manageAuthToken is not implemented yet - this app uses magic-link auth with no ' +
        'password grant. See the TODO above this function for what needs deciding first.',
    )
  },

  // No local cache beyond what auth-session itself manages on disk.
  clearToken: () => {},

  // createAuthFixtures()'s context/page override reads this directly rather
  // than Playwright's resolved `use.baseURL` - without it every test using
  // `page`/`context` fails navigation with "No baseURL found".
  getBaseUrl: () => getBaseUrl(),
}

setAuthProvider(supabaseAuthProvider)

// playwright-utils deviation: @seontechnologies/playwright-utils@4.4.0's
// generated .d.ts for createAuthFixtures() collapses the `option`-fixture
// tuples (Playwright's `[value, { option: true }]` shape) into a plain
// array-of-union type, which doesn't structurally match base.extend()'s
// Fixtures<> parameter even though the runtime shape is correct. Casting
// through `unknown` here; the underlying object is exactly what
// base.extend() expects at runtime.
const authFixturesBase = base.extend<AuthFixtures>(
  createAuthFixtures() as unknown as Parameters<typeof base.extend<AuthFixtures>>[0],
)

// createAuthFixtures() defaults authSessionEnabled to true, which makes
// every test using `page`/`context` go through manageAuthToken - and that's
// unimplemented (see the TODO above). Default it off project-wide until
// manageAuthToken is built; a test that specifically needs auth can opt in
// with `test.use({ authSessionEnabled: true })`.
export const test = authFixturesBase.extend<AuthFixtures>({
  authSessionEnabled: false,
})
export { expect } from '@playwright/test'
