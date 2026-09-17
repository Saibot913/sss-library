import { test as base } from '@playwright/test'
import {
  type AuthFixtures,
  type AuthProvider,
  createAuthFixtures,
  getStorageStatePath,
  loadStorageState,
  saveStorageState,
  setAuthProvider,
} from '@seontechnologies/playwright-utils/auth-session'
import { getBaseUrl } from './base-url'
import { mintSessionForEmail } from './mint-session'
import { testPatronEmail } from './supabase-admin'

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
  // userIdentifier doubles as the email to mint a session for - defaults to
  // the seeded patron account (see tests/support/seed-test-accounts.ts).
  // Tests needing the staff account opt in with
  // `test.use({ authOptions: { userIdentifier: process.env.TEST_STAFF_EMAIL } })`.
  getUserIdentifier: options => options?.userIdentifier ?? process.env.TEST_PATRON_EMAIL ?? 'default-user',

  extractToken: tokenData => parseSupabaseSession(tokenData)?.access_token ?? null,

  // Supabase's browser client keeps the session in localStorage, not cookies,
  // so there is nothing to inject here for this project.
  extractCookies: () => [],

  // The actual mechanism for this app: write the session back into
  // localStorage so it's present before the app's first script runs.
  extractStorage: tokenData => getOrigins(tokenData).map(o => ({ origin: o.origin, localStorage: o.localStorage ?? [] })),

  // rawToken here is whatever extractToken returned (the JWT string itself),
  // which carries no expiry info we bother decoding - a missing token is
  // the only case treated as "expired" and worth re-minting. Supabase's
  // client-side auto-refresh (using the refresh_token also written into
  // localStorage) covers ordinary access-token expiry once the page loads.
  isTokenExpired: rawToken => !rawToken,

  // This app signs patrons in via a Supabase magic-link email (see
  // src/lib/auth.ts requestSignInCode -> the auth-email Edge Function),
  // which has no password/API grant a test runner can drive directly.
  // Instead: mint a real session server-side via the service-role admin API
  // (see tests/support/mint-session.ts).
  //
  // playwright-utils's context/page fixtures read storage state straight off
  // disk (`getStorageStatePath(authOptions)`) rather than from whatever this
  // function returns - the interface doc's "checking storage ... and saving
  // tokens" is this provider's job, not the library's. So this reads/writes
  // that exact cache file itself: reuse it if present, otherwise mint and
  // persist a fresh one in Playwright's storage-state format before
  // returning it (the return value only otherwise feeds the `authToken`
  // fixture, via extractToken below).
  manageAuthToken: async (_request, options) => {
    const statePath = getStorageStatePath(options)
    // A cached file is only valid if it was written for the *same* origin
    // this run is actually testing against. Without this check, a
    // storage-state.json left over from a run against a different port
    // (a previous local run, a different Conductor workspace's assigned
    // port, etc.) gets silently reused -- the token itself isn't expired,
    // but the browser navigates to today's baseURL while the cached
    // localStorage entry is scoped to yesterday's, so it never applies and
    // every test using this account loads signed-out with no visible error
    // pointing at why. Cost this a real debugging session once; don't
    // repeat it.
    const cached = loadStorageState(statePath) as Record<string, unknown> | null
    const cachedOrigin = cached ? getOrigins(cached)[0]?.origin : undefined
    if (cached && cachedOrigin === getBaseUrl() && !supabaseAuthProvider.isTokenExpired!(supabaseAuthProvider.extractToken(cached) ?? '')) {
      return cached
    }

    const email = options?.userIdentifier ?? testPatronEmail()
    const session = await mintSessionForEmail(email)
    const tokenData = {
      origins: [
        {
          origin: getBaseUrl(),
          localStorage: [{ name: SUPABASE_STORAGE_KEY, value: JSON.stringify(session) }],
        },
      ],
    }
    saveStorageState(statePath, { cookies: [], origins: tokenData.origins })
    return tokenData
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

// createAuthFixtures() defaults authSessionEnabled to true, which would make
// every test using `page`/`context` mint a session even when it doesn't need
// one. Default it off project-wide; a test that specifically needs auth
// opts in with `test.use({ authSessionEnabled: true })`.
// createAuthFixtures() also defaults authOptions.userIdentifier to the
// literal string 'default', not undefined - so the `options?.userIdentifier
// ?? testPatronEmail()` fallback in manageAuthToken above never actually
// triggers unless a spec overrides authOptions itself. Default it here to
// the seeded patron account instead; staff-only specs override with
// `test.use({ authOptions: { userIdentifier: process.env.TEST_STAFF_EMAIL } })`.
export const test = authFixturesBase.extend<AuthFixtures>({
  authSessionEnabled: false,
  authOptions: { userIdentifier: process.env.TEST_PATRON_EMAIL },
})
export { expect } from '@playwright/test'
