import type { Page } from '@playwright/test'

// Mirrors src/lib/siteAccess.ts - the whole app is gated behind a shared,
// non-secret password (see that file's comment: "NOT real security").
// Pre-granting it via an init script avoids every test having to click
// through the gate screen first.
const STORAGE_KEY = 'sss-library-site-access'

export async function grantSiteAccess(page: Page): Promise<void> {
  await page.addInitScript(key => {
    window.localStorage.setItem(key, 'granted')
  }, STORAGE_KEY)
}
