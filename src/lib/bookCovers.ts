import { useEffect, useState } from 'react'

// Cover art isn't stored in Supabase, so it's resolved client-side via the
// Google Books API and cached (in-memory + localStorage) so the same book
// is never re-fetched.
//
// The anonymous (keyless) API is NOT viable: Google now returns
// `429 RESOURCE_EXHAUSTED` with `quota_limit_value: "0"` for any unauthenticated
// request — this isn't rate limiting from volume, anonymous access is flatly
// disabled. Confirmed with curl against the real endpoint; CORS is not the
// issue (the response includes `access-control-allow-origin` echoing the
// request Origin). A valid API key fixes it (invalid keys get a different,
// key-specific 400 error, not the quota 429), so no server-side proxy is
// needed — set VITE_GOOGLE_BOOKS_API_KEY in .env, restricted to the Books API
// and your app's HTTP referrer(s) in Google Cloud Console. Without a key set,
// this hook degrades to always returning null (existing 📖 placeholder).
const CACHE_PREFIX = 'bookCover:'
const memoryCache = new Map<string, string | null>()

function cacheKey(title: string, author: string): string {
  return `${CACHE_PREFIX}${title}::${author}`
}

async function fetchCoverUrl(title: string, author: string): Promise<string | null> {
  const apiKey = import.meta.env.VITE_GOOGLE_BOOKS_API_KEY
  if (!apiKey) return null

  const query = encodeURIComponent(`intitle:${title}+inauthor:${author}`)
  const url = `https://www.googleapis.com/books/v1/volumes?q=${query}&maxResults=1&key=${apiKey}`

  const response = await fetch(url)
  if (!response.ok) return null

  const data = await response.json()
  const thumbnail = data?.items?.[0]?.volumeInfo?.imageLinks?.thumbnail
  if (!thumbnail) return null

  // Google serves these over http:// by default; upgrade to https to avoid
  // mixed-content blocking.
  return thumbnail.replace(/^http:\/\//, 'https://')
}

// Only call this for a single book at a time (e.g. a detail page) — the
// anonymous-free-tier-equivalent quota on a real API key is still limited,
// and firing it across a whole catalog grid will exhaust it quickly.
export function useBookCover(title: string, author: string, enabled: boolean = true): string | null {
  const key = cacheKey(title, author)
  const [cover, setCover] = useState<string | null>(() => {
    if (memoryCache.has(key)) return memoryCache.get(key) ?? null
    const stored = localStorage.getItem(key)
    return stored ? JSON.parse(stored) : null
  })

  useEffect(() => {
    if (!enabled) return
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
    fetchCoverUrl(title, author)
      .then(url => {
        memoryCache.set(key, url)
        localStorage.setItem(key, JSON.stringify(url))
        if (!cancelled) setCover(url)
      })
      .catch(() => {
        memoryCache.set(key, null)
        localStorage.setItem(key, JSON.stringify(null))
        if (!cancelled) setCover(null)
      })
    return () => { cancelled = true }
  }, [key, title, author, enabled])

  return cover
}
