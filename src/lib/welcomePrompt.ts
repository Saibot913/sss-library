// Whether the sign-in / sign-up prompt has already been shown this browser
// session. sessionStorage so it comes back on a fresh visit but not on every
// reload; failures (private mode, blocked storage) just mean it may show again.
const KEY = 'sss-library-welcome-prompt-seen'

export function hasSeenWelcomePrompt(): boolean {
  try {
    return sessionStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

export function markWelcomePromptSeen(): void {
  try {
    sessionStorage.setItem(KEY, '1')
  } catch {
    // ignore
  }
}
