import type { Page } from '@playwright/test'

// The site no longer has a password gate, but it opens a sign-in/sign-up
// modal on the first visit of a session (src/lib/welcomePrompt.ts). Tests
// mark it as already shown so it doesn't cover the page under test. The
// function keeps its old name so existing specs don't all need touching.
const STORAGE_KEY = 'sss-library-welcome-prompt-seen'

export async function grantSiteAccess(page: Page): Promise<void> {
  await page.addInitScript(key => {
    window.sessionStorage.setItem(key, '1')
  }, STORAGE_KEY)
}
