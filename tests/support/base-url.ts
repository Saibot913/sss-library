// Shared by playwright.config.ts and auth-fixture.ts so the two can't drift.
export function getBaseUrl(): string {
  const port = process.env.PORT || '8443'
  return process.env.BASE_URL || `http://localhost:${port}`
}
