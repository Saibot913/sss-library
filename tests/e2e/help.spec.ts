import { test, expect } from '../support/merged-fixtures'
import { grantSiteAccess } from '../support/helpers/site-access'

test.describe('Help page', () => {
  test('[P1] the Help tab shows the FAQ and the report-an-issue section', async ({ page }) => {
    await grantSiteAccess(page)
    await page.goto('/')

    await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: /Help/ }).click()
    await expect(page).toHaveURL(/\/help$/)
    await expect(page.getByRole('heading', { name: 'How borrowing works' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Tap Check Out on My Books' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Frequently asked questions' })).toBeVisible()

    const collectQuestion = page.locator('details', { hasText: 'Where do I collect my book from?' })
    await collectQuestion.getByText('Where do I collect my book from?').click()
    await expect(collectQuestion.getByText('Answer coming soon.')).toBeVisible()

    await expect(page.getByRole('heading', { name: 'Still need help?' })).toBeVisible()
  })
})
