import { test, expect } from '../support/merged-fixtures'
import { mintSessionForEmail } from '../support/mint-session'
import { testPatronEmail } from '../support/supabase-admin'

const SUPABASE_URL = process.env.API_URL ?? 'https://gpekfosbyobdffavrumi.supabase.co'
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? ''

// Security test: a signed-in PATRON calling staff-only RPCs directly
// (bypassing the UI, which never exposes these to a patron) must be
// rejected by is_staff() server-side, not silently succeed. Calls the RPCs
// directly via apiRequest - see supabase/migrations/0009_staff_dashboard_rpcs.sql,
// 0022_fix_patron_name_missing_space.sql (staff_list_checkouts) and
// 0025_fix_staff_return_book_ambiguous_column.sql (staff_return_book).
test.describe('Permission boundaries', () => {
  test('[P0] a patron calling staff_list_checkouts directly is rejected', async ({ apiRequest }) => {
    const session = await mintSessionForEmail(testPatronEmail())

    const { status, body } = await apiRequest<{ message?: string }>({
      method: 'POST',
      baseUrl: SUPABASE_URL,
      path: '/rest/v1/rpc/staff_list_checkouts',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: {},
    })

    expect(status).not.toBe(200)
    expect(body.message ?? '').toMatch(/only staff/i)
  })

  test('[P0] a patron calling staff_return_book directly is rejected', async ({ apiRequest }) => {
    const session = await mintSessionForEmail(testPatronEmail())

    const { status, body } = await apiRequest<{ message?: string }>({
      method: 'POST',
      baseUrl: SUPABASE_URL,
      path: '/rest/v1/rpc/staff_return_book',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      // A nonexistent label is fine here - the is_staff() check runs and
      // rejects before this value is ever looked up.
      body: { p_full_label: 'does-not-matter' },
    })

    expect(status).not.toBe(200)
    expect(body.message ?? '').toMatch(/only staff/i)
  })
})
