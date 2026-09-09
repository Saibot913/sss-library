// playwright-utils deviation: data-factories.md suggests Faker-based factories,
// but this project doesn't have @faker-js/faker installed and adding another
// dependency wasn't part of what was approved for this setup. These use
// crypto.randomUUID()/Date.now() instead - swap in Faker later if richer
// randomized data is needed.

export function searchQueryFactory(overrides: Partial<{ query: string }> = {}): { query: string } {
  return {
    query: overrides.query ?? `test-search-${Date.now()}`,
  }
}
