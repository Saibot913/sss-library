import { test, expect } from '../support/merged-fixtures'
import { grantSiteAccess } from '../support/helpers/site-access'
import { mintSessionForEmail } from '../support/mint-session'
import { testPatronEmail } from '../support/supabase-admin'

const SUPABASE_URL = process.env.API_URL ?? 'https://gpekfosbyobdffavrumi.supabase.co'
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? ''

// staff_return_book() had a real SQL bug (42702 "ambiguous column") that
// broke every return silently since the function was introduced - see
// supabase/migrations/0025_fix_staff_return_book_ambiguous_column.sql.
test.describe('Staff returns', () => {
  test.use({ authSessionEnabled: true, authOptions: { userIdentifier: process.env.TEST_STAFF_EMAIL } })

  test('[P0] staff marks an open checkout as returned and it drops off the open-checkouts list', async ({ page, apiRequest }) => {
    // Given: a fresh open checkout, created directly via the RPCs the
    // catalog UI itself calls (not raw SQL) so this seeds through the real
    // checkout_book() function, using the seeded patron's own session.
    const patronSession = await mintSessionForEmail(testPatronEmail())
    const patronHeaders = {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${patronSession.access_token}`,
      'Content-Type': 'application/json',
    }

    const { body: availableCopies } = await apiRequest<{ full_label: string }[]>({
      method: 'GET',
      baseUrl: SUPABASE_URL,
      path: '/rest/v1/copies?select=full_label&status=eq.available&limit=1',
      headers: patronHeaders,
    })
    expect(availableCopies.length, 'need at least one available copy in the catalog to seed this test').toBeGreaterThan(0)
    const fullLabel = availableCopies[0].full_label

    const { status: checkoutStatus } = await apiRequest({
      method: 'POST',
      baseUrl: SUPABASE_URL,
      path: '/rest/v1/rpc/checkout_book',
      headers: patronHeaders,
      body: { p_full_label: fullLabel },
    })
    // checkout_book() `returns void` - PostgREST responds 204, not 200.
    expect(checkoutStatus).toBe(204)

    // When: staff processes the return through the UI. Navigated via the nav
    // link rather than page.goto('/staff/returns') directly - App.tsx's
    // is_staff() check resolves asynchronously after mount, and a direct
    // load can hit the route guard's redirect-home before that check
    // finishes; getting there through the app's own nav means it's already
    // resolved by the time the route renders.
    await grantSiteAccess(page)
    await page.goto('/catalog')
    await page.locator('header').getByRole('button', { name: 'Staff' }).click()
    await page.getByRole('button', { name: 'Returns & Holds' }).click()
    await expect(page.getByRole('heading', { name: 'Open Checkouts' })).toBeVisible()

    const row = page.locator('tr', { has: page.getByText(fullLabel) })
    await expect(row).toBeVisible()
    await row.getByRole('button', { name: 'Mark Returned' }).click()

    // Then: it's confirmed and drops off the open list
    await expect(page.getByText(new RegExp(`Marked .* \\(${fullLabel}\\) as returned`))).toBeVisible()
    await expect(page.locator('tr', { has: page.getByText(fullLabel) })).not.toBeVisible()

    // And: the copy is available again
    const { body: copyAfterReturn } = await apiRequest<{ status: string }[]>({
      method: 'GET',
      baseUrl: SUPABASE_URL,
      path: `/rest/v1/copies?select=status&full_label=eq.${encodeURIComponent(fullLabel)}`,
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    })
    expect(copyAfterReturn[0]?.status).toBe('available')
  })
})
