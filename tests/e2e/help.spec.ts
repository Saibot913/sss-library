import { test, expect } from '../support/merged-fixtures'
import { grantSiteAccess } from '../support/helpers/site-access'

test.describe('Help page', () => {
  test('[P1] the Help tab shows the FAQ and the report-an-issue section', async ({ page }) => {
    await grantSiteAccess(page)
    await page.goto('/')

    await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: /Help/ }).click()
    await expect(page).toHaveURL(/\/help$/)
    await expect(page.getByRole('heading', { name: 'Frequently asked questions' })).toBeVisible()

    const firstQuestion = page.getByText('How do I check out a book?')
    await firstQuestion.click()
    await expect(page.getByText('Answer coming soon.').first()).toBeVisible()

    await expect(page.getByRole('heading', { name: 'Still need help?' })).toBeVisible()
  })
})
