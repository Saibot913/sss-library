import { test, expect } from '../support/merged-fixtures'
import { grantSiteAccess } from '../support/helpers/site-access'

// This exact flow (add to cart -> check out -> show up under "Currently
// checked out") was broken in production for an unknown period before being
// fixed this week - see CHANGELOG.md's checkout/profile-modal "Fixed"
// entries. The seeded patron (tests/support/seed-test-accounts.ts) already
// has a complete profile, so this covers the checkout itself rather than
// the profile-completion gate (that's signup.spec.ts).
test.describe('Checkout', () => {
  test.use({ authSessionEnabled: true }) // defaults to the seeded patron identity

  test('[P0] a signed-in patron checks out an available book and sees it under Currently checked out', async ({ page }) => {
    await grantSiteAccess(page)
    await page.goto('/catalog')

    // Given: an available book
    await page.getByText('Available now', { exact: true }).click()
    const firstResult = page.locator('h3').first()
    await expect(firstResult).toBeVisible()
    const bookTitle = (await firstResult.textContent())?.trim() ?? ''
    expect(bookTitle).not.toBe('')
    await firstResult.click()

    // When: they add it to their cart and check out
    await page.getByRole('button', { name: '+ Add to Cart' }).click()
    await expect(page.getByRole('button', { name: '✓ Added to Cart' })).toBeVisible()

    // Scoped to <header> - "Cart" also substring-matches the book detail
    // page's "✓ Added to Cart" button.
    await page.locator('header').getByRole('button', { name: 'Cart' }).click()
    await page.getByRole('button', { name: /Check Out \d+ Books?/ }).click()
    await expect(page.getByRole('heading', { name: 'Your Cart' })).not.toBeVisible()

    // Then: the book appears under "Currently checked out" on their account page.
    // .first() because the seeded patron account is reused across test runs,
    // so the same title can legitimately show up more than once here.
    await page.getByRole('button', { name: 'My Books' }).click()
    await expect(page).toHaveURL(/\/account$/)
    const checkedOutSection = page.locator('section', { has: page.getByRole('heading', { name: /Currently checked out/ }) })
    await expect(checkedOutSection.getByText(bookTitle).first()).toBeVisible()
  })
})
