import { test, expect } from '../support/merged-fixtures'
import { grantSiteAccess } from '../support/helpers/site-access'
import { mintSessionForEmail } from '../support/mint-session'
import { testPatronEmail } from '../support/supabase-admin'

const SUPABASE_URL = process.env.API_URL ?? 'https://gpekfosbyobdffavrumi.supabase.co'
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? ''

// Full loan lifecycle on the staff page: reserved -> picked up -> returned ->
// back on the shelf. (staff_return_book() once had a real SQL bug, 42702
// "ambiguous column", that broke every return silently - see
// supabase/migrations/0025_fix_staff_return_book_ambiguous_column.sql.)
test.describe('Staff returns', () => {
  test.use({ authSessionEnabled: true, authOptions: { userIdentifier: process.env.TEST_STAFF_EMAIL } })

  test('[P0] a reserved book goes pickup -> checked out -> return shelf -> back on the shelf', async ({ page, apiRequest }) => {
    // Given: a fresh reservation, created through the same RPC the cart's
    // "Check Out" button calls, using the seeded patron's own session.
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

    const { status: reserveStatus } = await apiRequest({
      method: 'POST',
      baseUrl: SUPABASE_URL,
      path: '/rest/v1/rpc/reserve_for_pickup',
      headers: patronHeaders,
      body: { p_full_label: fullLabel },
    })
    // reserve_for_pickup() `returns void` - PostgREST responds 204, not 200.
    expect(reserveStatus).toBe(204)

    const copyStatus = async () => {
      const { body } = await apiRequest<{ status: string }[]>({
        method: 'GET',
        baseUrl: SUPABASE_URL,
        path: `/rest/v1/copies?select=status&full_label=eq.${encodeURIComponent(fullLabel)}`,
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
      })
      return body[0]?.status
    }
    expect(await copyStatus()).toBe('reserved')

    // When: staff open Returns & Holds. Navigated via the nav link rather
    // than page.goto('/staff/returns') directly - App.tsx's is_staff() check
    // resolves asynchronously after mount, and a direct load can hit the
    // route guard's redirect-home before that check finishes.
    await grantSiteAccess(page)
    await page.goto('/catalog')
    await page.locator('header').getByRole('button', { name: 'Staff' }).click()
    await page.getByRole('button', { name: 'Returns & Holds' }).click()
    await expect(page.getByRole('heading', { name: 'Open Checkouts' })).toBeVisible()

    // Pickup: reserved -> checked out
    const reservedRow = page.locator('tr', { has: page.getByText(fullLabel) })
    await expect(reservedRow).toBeVisible()
    await reservedRow.getByRole('button', { name: 'Mark Picked Up' }).click()
    await expect(page.getByText(new RegExp(`Checked out .* \\(${fullLabel}\\) to the patron`))).toBeVisible()
    expect(await copyStatus()).toBe('checked_out')

    // Return: checked out -> return shelf (NOT yet available)
    const openRow = page.locator('tr', { has: page.getByText(fullLabel) }).filter({ has: page.getByRole('button', { name: 'Mark Returned' }) })
    await expect(openRow).toBeVisible()
    await openRow.getByRole('button', { name: 'Mark Returned' }).click()
    await expect(page.getByText(new RegExp(`Marked .* \\(${fullLabel}\\) as returned`))).toBeVisible()
    expect(await copyStatus()).toBe('returned')

    // Reshelve: return shelf -> available
    const shelfRow = page.locator('tr', { has: page.getByText(fullLabel) }).filter({ has: page.getByRole('button', { name: 'Back on Shelf' }) })
    await expect(shelfRow).toBeVisible()
    await shelfRow.getByRole('button', { name: 'Back on Shelf' }).click()
    await expect(page.getByText(new RegExp(`\\(${fullLabel}\\) is back on the shelf and available`))).toBeVisible()
    expect(await copyStatus()).toBe('available')
  })
})
