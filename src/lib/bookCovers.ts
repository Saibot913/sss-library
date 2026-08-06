// TODO(team): implement cover art lookup.
//
// Cover art isn't stored in Supabase. First attempt was a client-side
// call to the Google Books API (no key required for low volume:
// https://www.googleapis.com/books/v1/volumes?q=intitle:{title}+inauthor:{author})
// but it didn't work — wasn't debugged further, could be a bad query
// format, rate limiting, or a CORS issue on whatever setup was used to
// test it. Worth retrying and actually reading the failed response
// before assuming the API itself is the problem; if it does turn out
// to be CORS, proxy the call through a Supabase Edge Function instead
// of calling Google directly from the browser.
//
// Whatever the source ends up being, cache the result (in-memory +
// localStorage) so the same book isn't re-fetched on every render or
// page load.
//
// `<BookCover>` in App.tsx already renders a 📖 placeholder whenever
// this hook returns null, so it's safe to leave unimplemented while
// building out other features — the catalog will just show placeholders.
export function useBookCover(_title: string, _author: string): string | null {
  return null
}
