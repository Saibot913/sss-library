import { test, expect } from '../support/merged-fixtures'
import { grantSiteAccess } from '../support/helpers/site-access'
import { mintSessionForEmail } from '../support/mint-session'

// Supabase's project-level redirect-URL allowlist (configured in the
// dashboard, not in this repo) means we can't drive the *actual* magic-link
// email/click end-to-end here without also depending on that dashboard
// config. Instead this mints a real session the same way a clicked magic
// link would produce one (see tests/support/mint-session.ts) for a
// brand-new, never-seen-before email, then verifies the part of the flow
// that's actually testable: landing on profile completion and reaching the
// catalog after filling it in.
const SUPABASE_PROJECT_REF = 'gpekfosbyobdffavrumi'
const SUPABASE_STORAGE_KEY = `sb-${SUPABASE_PROJECT_REF}-auth-token`

test.describe('Signup', () => {
  test('[P0] a brand-new patron completes their profile and lands on the catalog', async ({ page }) => {
    const email = `playwright-signup-${crypto.randomUUID()}@sss-library-test.invalid`
    const session = await mintSessionForEmail(email)

    await page.addInitScript(
      ({ key, value }) => window.localStorage.setItem(key, value),
      { key: SUPABASE_STORAGE_KEY, value: JSON.stringify(session) },
    )
    await grantSiteAccess(page)
    // ?auth=signup mirrors what the real magic-link redirect URL carries for
    // signup mode (see supabase/functions/auth-email) - it's what makes
    // ProfilePage render in onboarding mode.
    await page.goto('/profile?auth=signup')

    // Given: a signed-in account with no name/phone on file yet (fresh signup)
    await expect(page.getByRole('heading', { name: 'Create your library profile' })).toBeVisible()

    // When: the new patron fills in and saves their profile
    await page.getByRole('textbox', { name: 'First Name' }).fill('New')
    await page.getByRole('textbox', { name: 'Last Name' }).fill('Patron')
    await page.getByRole('textbox', { name: 'Phone Number' }).fill('555-0199')
    await page.getByRole('button', { name: 'Save profile' }).click()

    // Then: they can continue on to the catalog
    await page.getByRole('button', { name: 'Continue to catalog' }).click()
    await expect(page).toHaveURL(/\/catalog$/)
  })
})
