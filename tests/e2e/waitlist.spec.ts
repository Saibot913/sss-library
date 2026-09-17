import { test, expect } from '../support/merged-fixtures'
import { grantSiteAccess } from '../support/helpers/site-access'

// Signed-in coverage (actually joining/leaving a waitlist) isn't possible
// yet — this app's auth fixture can't mint a session because there's no
// password/API grant for the magic-link flow (see tests/README.md and the
// TODO in tests/support/auth-fixture.ts). These specs cover what's testable
// without a session: the gating behavior, which mirrors "Add to Cart"'s.

test.describe('Waitlist gating on the book detail page', () => {
  test('[P0] a signed-out patron sees Join Waitlist on a fully-checked-out book, and it opens the login modal', async ({ page }) => {
    await grantSiteAccess(page)
    await page.goto('/catalog')

    // Filter down to books with zero available copies (sidebar "Availability" radio).
    await page.getByText('On loan', { exact: true }).click()

    const firstResult = page.locator('h3').first()
    await expect(firstResult).toBeVisible()
    await firstResult.click()

    const joinButton = page.getByRole('button', { name: 'Join Waitlist' })
    await expect(joinButton).toBeVisible()
    await expect(page.getByRole('button', { name: '+ Add to Cart' })).not.toBeVisible()

    await joinButton.click()
    await expect(page.getByRole('heading', { name: 'Log In' })).toBeVisible()
  })

  test('[P1] a book with available copies shows Add to Cart, not Join Waitlist', async ({ page }) => {
    await grantSiteAccess(page)
    await page.goto('/catalog')

    await page.getByText('Available now', { exact: true }).click()

    const firstResult = page.locator('h3').first()
    await expect(firstResult).toBeVisible()
    await firstResult.click()

    await expect(page.getByRole('button', { name: '+ Add to Cart' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Join Waitlist' })).not.toBeVisible()
  })
})
