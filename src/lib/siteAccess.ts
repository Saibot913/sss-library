// A shared site-wide password — NOT real security. It keeps the site off
// search engines and away from casual outsiders (a "you're one of us"
// gate), but the underlying Supabase data stays reachable directly by
// anyone with the anon key regardless of this screen (see the public
// read policies on books/copies). Decided this tradeoff is fine: see
// project-instructions/README.md, "Open decisions".
export const SITE_PASSWORD = 'loveallserveall'

const STORAGE_KEY = 'sss-library-site-access'

export function hasSiteAccess(): boolean {
  return localStorage.getItem(STORAGE_KEY) === 'granted'
}

export function grantSiteAccess(): void {
  localStorage.setItem(STORAGE_KEY, 'granted')
}
