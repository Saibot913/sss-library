import { test, expect } from '../support/merged-fixtures'
import { grantSiteAccess } from '../support/helpers/site-access'

// This exact flow (add to cart -> check out -> show up on their account) was broken in production for an unknown period before being
// fixed this week - see CHANGELOG.md's checkout/profile-modal "Fixed"
// entries. The seeded patron (tests/support/seed-test-accounts.ts) already
// has a complete profile, so this covers the checkout itself rather than
// the profile-completion gate (that's signup.spec.ts).
test.describe('Checkout', () => {
  test.use({ authSessionEnabled: true }) // defaults to the seeded patron identity

  test('[P0] a signed-in patron checks out an available book and it is reserved for pickup', async ({ page }) => {
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

    // Then: checking out only RESERVES the book (staff mark the pickup at the
    // center, which is what makes it a real checkout). A dialog names the
    // book, its category and the copy ID...
    const receipt = page.getByRole('dialog', { name: 'Reservation confirmed' })
    await expect(receipt.getByText(bookTitle)).toBeVisible()
    await expect(receipt.getByText(/Category:/)).toBeVisible()
    await expect(receipt.getByText(/Copy ID:/)).toBeVisible()
    await receipt.getByRole('button', { name: 'Got it' }).click()

    // ...and the book appears under "Reserved" on their account page.
    // .first() because the seeded patron account is reused across test runs,
    // so the same title can legitimately show up more than once here.
    await page.getByRole('button', { name: 'My Books' }).click()
    await expect(page).toHaveURL(/\/account$/)
    const reservedSection = page.locator('section', { has: page.getByRole('heading', { name: /Reserved, ready to collect/ }) })
    await expect(reservedSection.getByText(bookTitle).first()).toBeVisible()

    // Once they've collected it, the patron checks it out themselves
    await reservedSection.getByRole('button', { name: 'Check Out' }).first().click()
    const checkedOutSection = page.locator('section', { has: page.getByRole('heading', { name: /Currently checked out/ }) })
    await expect(checkedOutSection.getByText(bookTitle).first()).toBeVisible()
  })
})
