import { test, expect } from '../support/merged-fixtures'
import { grantSiteAccess } from '../support/helpers/site-access'

test.describe('Home page', () => {
  test('[P0] renders the hero and lets a patron search the catalog', async ({ page }) => {
    // Given: a patron lands on the home page (past the shared site-access gate)
    await grantSiteAccess(page)
    await page.goto('/')

    // Then: the hero renders
    await expect(page.getByRole('heading', { level: 1, name: 'Sai Library' })).toBeVisible()

    // When: they search from the hero search box
    await page.getByPlaceholder('Search by title, author, keyword…').fill('gita')
    await page.getByRole('button', { name: 'Search' }).click()

    // Then: they land on the catalog page with the query applied
    await expect(page).toHaveURL(/\/catalog/)
  })
})
