import { test, expect } from '../support/merged-fixtures'
import { grantSiteAccess } from '../support/helpers/site-access'

test.describe('Login', () => {
  test.use({ authSessionEnabled: true }) // defaults to the seeded patron identity

  test('[P0] an existing patron with a session lands signed in and can reach their account', async ({ page }) => {
    await grantSiteAccess(page)

    // Given: a patron with an existing, complete-profile account (seeded via
    // tests/support/seed-test-accounts.ts) and a real session
    await page.goto('/catalog')

    // Then: the header shows them as signed in, not "Log In"
    await expect(page.getByRole('button', { name: 'My Books' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Log In' })).not.toBeVisible()

    // When: they open their account activity page
    await page.getByRole('button', { name: 'My Books' }).click()

    // Then: it loads without redirecting them back to signed-out home
    await expect(page).toHaveURL(/\/account$/)
    await expect(page.getByRole('heading', { name: 'Library activity' })).toBeVisible()
  })
})
