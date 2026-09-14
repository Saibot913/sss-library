import { test, expect, log } from '../support/merged-fixtures'

const SUPABASE_URL = process.env.API_URL ?? 'https://gpekfosbyobdffavrumi.supabase.co'
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY

test.describe('Books API (Supabase PostgREST)', () => {
  test('[P0] the public books table is readable without auth', async ({ apiRequest }) => {
    // no response schema found for `books`; assertions cover the fields under test only
    await log.step('Fetch one row from the public books table')

    const { status, body } = await apiRequest<{ book_code: string }[]>({
      method: 'GET',
      baseUrl: SUPABASE_URL,
      path: '/rest/v1/books?select=book_code&limit=1',
      headers: {
        apikey: SUPABASE_ANON_KEY ?? '',
        // Supabase's PostgREST needs both headers: apikey identifies the
        // project, Authorization is what it decodes to resolve the `anon`
        // role (this is what @supabase/supabase-js sends on every request).
        Authorization: `Bearer ${SUPABASE_ANON_KEY ?? ''}`,
      },
    })

    expect(status).toBe(200)
    expect(Array.isArray(body)).toBe(true)
  })
})
