import { useEffect, useState } from 'react'

// Cover art isn't stored in Supabase, so it's resolved client-side and
// cached (in-memory + localStorage) so the same book is never re-fetched.
//
// Two sources, tried in order:
// 1. Google Books API. The anonymous (keyless) API is NOT viable: Google
//    returns `429 RESOURCE_EXHAUSTED` with `quota_limit_value: "0"` for any
//    unauthenticated request — this isn't rate limiting from volume,
//    anonymous access is flatly disabled. A valid API key fixes it (invalid
//    keys get a different, key-specific 400 error, not the quota 429), so
//    no server-side proxy is needed — set VITE_GOOGLE_BOOKS_API_KEY in
//    .env, restricted to the Books API and your app's HTTP referrer(s) in
//    Google Cloud Console.
// 2. Open Library (Internet Archive), free and keyless. Covers a different,
//    partially-overlapping set of titles than Google — worth trying when
//    Google has nothing, but plenty of books in a niche catalog like this
//    one won't be indexed by either, and correctly fall back to the 📖
//    placeholder.
//
// Enabled across the whole catalog grid, not just single-book views — the
// `useInView` gate below means covers only fetch for cards actually
// scrolled into view, so a 100+ book grid doesn't fire every request at
// once and burn through the API quota in one page load.
const CACHE_PREFIX = 'bookCover:'
const memoryCache = new Map<string, string | null>()

// Dedupes concurrent requests for the same book — without this, StrictMode's
// mount→cleanup→mount in dev (or the same book rendered in two places at
// once, e.g. cart + catalog grid) each see an empty memoryCache before
// either request resolves, and both fire a real network call.
const inFlight = new Map<string, Promise<string | null>>()

function fetchCoverUrlDeduped(key: string, title: string, author: string): Promise<string | null> {
  const existing = inFlight.get(key)
  if (existing) return existing

  const promise = fetchCoverUrl(title, author).finally(() => { inFlight.delete(key) })
  inFlight.set(key, promise)
  return promise
}

function cacheKey(title: string, author: string): string {
  return `${CACHE_PREFIX}${title}::${author}`
}

// Thrown for failures that say nothing about whether the book actually has
// cover art — a rate limit or a server hiccup, not "confirmed no cover".
// The caller must not cache a negative result on this, or a transient burst
// (e.g. scrolling fast through a big catalog) permanently marks books as
// coverless in localStorage even though a retry later would have worked.
class TransientCoverError extends Error {}

async function fetchFromGoogleBooks(title: string, author: string): Promise<string | null> {
  const apiKey = import.meta.env.VITE_GOOGLE_BOOKS_API_KEY
  if (!apiKey) return null

  const query = encodeURIComponent(`intitle:${title}+inauthor:${author}`)
  const url = `https://www.googleapis.com/books/v1/volumes?q=${query}&maxResults=1&key=${apiKey}`

  const response = await fetch(url)
  if (response.status === 429 || response.status >= 500) {
    throw new TransientCoverError(`Google Books returned ${response.status}`)
  }
  if (!response.ok) return null

  const data = await response.json()
  const thumbnail = data?.items?.[0]?.volumeInfo?.imageLinks?.thumbnail
  if (!thumbnail) return null

  // Google serves these over http:// by default; upgrade to https to avoid
  // mixed-content blocking.
  return thumbnail.replace(/^http:\/\//, 'https://')
}

async function fetchFromOpenLibrary(title: string, author: string): Promise<string | null> {
  const query = encodeURIComponent(`title:${title} author:${author}`)
  const url = `https://openlibrary.org/search.json?q=${query}&fields=cover_i&limit=1`

  const response = await fetch(url)
  if (response.status === 429 || response.status >= 500) {
    throw new TransientCoverError(`Open Library returned ${response.status}`)
  }
  if (!response.ok) return null

  const data = await response.json()
  const coverId = data?.docs?.[0]?.cover_i
  if (!coverId) return null

  return `https://covers.openlibrary.org/b/id/${coverId}-M.jpg`
}

async function fetchCoverUrl(title: string, author: string): Promise<string | null> {
  let googleWasTransientFailure = false
  try {
    const fromGoogle = await fetchFromGoogleBooks(title, author)
    if (fromGoogle) return fromGoogle
  } catch (err) {
    if (!(err instanceof TransientCoverError)) throw err
    googleWasTransientFailure = true
  }

  try {
    const fromOpenLibrary = await fetchFromOpenLibrary(title, author)
    if (fromOpenLibrary) return fromOpenLibrary
  } catch (err) {
    if (!(err instanceof TransientCoverError)) throw err
    // Both sources transiently failed (or Google did and Open Library also
    // just failed) — propagate so the caller doesn't cache a false negative.
    throw err
  }

  // Open Library resolved cleanly with nothing, but Google only failed
  // transiently rather than confirming "no cover" — still not safe to
  // cache as a final answer.
  if (googleWasTransientFailure) throw new TransientCoverError('Google was rate-limited/erroring; Open Library had nothing either')

  return null
}

// Fetches only fire once the element is actually scrolled into view (plus a
// little lookahead margin), so mounting 100+ off-screen BookCover instances
// in a catalog grid doesn't fire 100+ requests at once.
function useInView<T extends HTMLElement>(): [(node: T | null) => void, boolean] {
  const [node, setNode] = useState<T | null>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    if (!node || inView) return
    const observer = new IntersectionObserver(
      entries => { if (entries[0]?.isIntersecting) setInView(true) },
      { rootMargin: '200px' }
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [node, inView])

  return [setNode, inView]
}

export function useBookCover(title: string, author: string, enabled: boolean = true): [string | null, (node: HTMLElement | null) => void] {
  const key = cacheKey(title, author)
  const [setRef, inView] = useInView()
  const [cover, setCover] = useState<string | null>(() => {
    if (memoryCache.has(key)) return memoryCache.get(key) ?? null
    const stored = localStorage.getItem(key)
    return stored ? JSON.parse(stored) : null
  })

  useEffect(() => {
    if (!enabled || !inView) return
    if (memoryCache.has(key)) {
      setCover(memoryCache.get(key) ?? null)
      return
    }
    const stored = localStorage.getItem(key)
    if (stored !== null) {
      const parsed = JSON.parse(stored)
      memoryCache.set(key, parsed)
      setCover(parsed)
      return
    }

    let cancelled = false
    fetchCoverUrlDeduped(key, title, author)
      .then(url => {
        memoryCache.set(key, url)
        localStorage.setItem(key, JSON.stringify(url))
        if (!cancelled) setCover(url)
      })
      .catch(err => {
        // A transient failure (rate limit, server error) isn't "confirmed
        // no cover" — don't poison the cache with it, or a burst of
        // requests during fast scrolling permanently marks books as
        // coverless even though a later retry would succeed.
        if (!(err instanceof TransientCoverError)) {
          memoryCache.set(key, null)
          localStorage.setItem(key, JSON.stringify(null))
        }
        if (!cancelled) setCover(null)
      })
    return () => { cancelled = true }
  }, [key, title, author, enabled, inView])

  return [cover, setRef]
}
