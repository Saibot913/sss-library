import { supabase } from './supabaseClient'

export type Book = {
  id: string
  title: string
  author: string
  year: string
  category: string
  keywords: string[]
  summary: string
  publisher: string
  copiesTotal: number
  copiesAvailable: number
  copies: Array<{
    fullLabel: string
    status: string | null
  }>
}

type CopyRow = {
  full_label: string
  status: string | null
}

type BookRow = {
  book_code: string
  title: string | null
  author: string | null
  year_published: string | null
  published_by: string | null
  category: string | null
  tags: string | null
  summary: string | null
  copies: CopyRow[] | null
}

// `copies` has column-level grants (migration 0001 step 8) that hide
// reserved_by/reserved_until from anon+authenticated, so `copies(*)` is
// rejected with a 401 — the embedded select must name its columns.
const SELECT =
  'book_code,title,author,year_published,published_by,category,tags,summary,copies(full_label,status)'

// PostgREST caps rows per response (1000 by default) and truncates
// silently rather than erroring, so a single unpaged request would
// quietly drop books once the catalog outgrows the cap. Today's data is
// well under it — this only matters as the catalog fills out.
const PAGE_SIZE = 1000

// Backstop against an unterminated paging loop (e.g. a server that keeps
// returning rows for out-of-range offsets). 200k books is far beyond any
// plausible size for this library.
const MAX_PAGES = 200

// A copy is lendable only when it is explicitly 'available'. This is an
// allowlist on purpose: with a denylist, any status nobody anticipated
// would read as available and the UI would offer copies that can't
// actually be borrowed.
//
// Only 'available' and 'checked_out' are produced by the current schema
// (checkout_book sets 'checked_out'; reserve_copy leaves status alone and
// writes reserved_until instead). The retired statuses below are
// forward-looking — confirm the real vocabulary with the project owner
// before anything starts writing them.
const AVAILABLE_STATUS = 'available'
const RETIRED_STATUSES = new Set(['lost', 'damaged', 'withdrawn'])

// Caveat: a copy held in someone's cart is still status 'available' — the
// 5-minute hold lives in reserved_until, which column grants hide from the
// client. So copiesAvailable can overcount by the number of active holds.
// The database rejects the checkout either way (reserve_copy/checkout_book
// re-check atomically), so this is a display gap, not a race.
function countCopies(copies: CopyRow[]) {
  let total = 0
  let available = 0
  for (const copy of copies) {
    // Retired copies are excluded from the total as well as from the
    // available count — otherwise the UI reads "3 of 5 available"
    // forever for a book whose other 2 copies are gone for good.
    if (copy.status !== null && RETIRED_STATUSES.has(copy.status)) continue
    total++
    if (copy.status === AVAILABLE_STATUS) available++
  }
  return { total, available }
}

// Every string field on `Book` is required, but most columns are nullable
// (as of writing: 16 books have no summary, 9 no tags, 8 no author, 5 no
// category). App.tsx calls .toLowerCase() on summary and author while
// filtering, so nulls have to become '' here rather than pass through.
function toBook(row: BookRow): Book {
  const copies = (row.copies ?? []).map(copy => ({
    fullLabel: copy.full_label,
    status: copy.status,
  }))
  const { total, available } = countCopies(row.copies ?? [])
  return {
    id: row.book_code,
    title: row.title ?? '',
    author: row.author ?? '',
    year: row.year_published ?? '',
    category: row.category ?? '',
    keywords: (row.tags ?? '')
      .split(',')
      .map(tag => tag.trim())
      .filter(Boolean),
    summary: row.summary ?? '',
    publisher: row.published_by ?? '',
    copiesTotal: total,
    copiesAvailable: available,
    copies,
  }
}

// The catalog is ~105 KB and almost entirely static — titles and authors
// don't change. Re-downloading it on every page load is wasted bandwidth
// and a visible delay before anything renders, so it's cached in
// localStorage and reused until it goes stale.
//
// Bump the version in the key whenever the shape of `Book` changes:
// entries written by an older build are parsed straight back into `Book[]`
// without validation, so a renamed field would otherwise surface as
// undefined at runtime instead of being discarded.
const CACHE_KEY = 'sss-library:books:v1'

// The one volatile part of a Book is copiesAvailable, so the TTL is really
// "how long may availability be wrong for?" Five minutes matches the
// reservation hold window in migration 0001, which is already the amount
// of staleness the checkout flow is built to tolerate. Cutting it shorter
// trades page-load speed for accuracy that the database re-checks anyway.
const CACHE_TTL_MS = 5 * 60 * 1000

type CacheEntry = {
  savedAt: number
  books: Book[]
}

// Every localStorage access is wrapped: it throws outright in some private
// browsing modes, and the cache is an optimisation, never a requirement.
function readCache(): CacheEntry | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CacheEntry
    if (typeof parsed?.savedAt !== 'number' || !Array.isArray(parsed.books)) return null
    return parsed
  } catch {
    return null
  }
}

function writeCache(books: Book[]): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), books }))
  } catch {
    // Quota exceeded or storage blocked — carry on uncached.
  }
}

/** Drop the cached catalog so the next fetchBooks() re-reads from Supabase. */
export function invalidateBooksCache(): void {
  try {
    localStorage.removeItem(CACHE_KEY)
  } catch {
    // Nothing cached to drop.
  }
}

function isFresh(entry: CacheEntry): boolean {
  const age = Date.now() - entry.savedAt
  // A negative age means the clock moved backwards since the write; treat
  // that as stale rather than letting a future timestamp pin the entry
  // as fresh indefinitely.
  return age >= 0 && age < CACHE_TTL_MS
}

// Collapses overlapping calls onto one network request. main.tsx renders
// under React.StrictMode, which deliberately runs effects twice in dev, so
// the catalog would otherwise be fetched twice on every load — neither
// call having written the cache before the other reads it.
let inFlight: Promise<Book[]> | null = null

export async function fetchBooks(): Promise<Book[]> {
  const cached = readCache()
  if (cached && isFresh(cached)) return cached.books
  if (inFlight) return inFlight

  inFlight = fetchAllBooks()
    .then(books => {
      writeCache(books)
      return books
    })
    .catch((err: unknown) => {
      // A stale catalog beats an error screen: the data is mostly static,
      // and the database re-checks availability at checkout regardless.
      if (cached) return cached.books
      throw err
    })
    .finally(() => {
      inFlight = null
    })

  return inFlight
}

async function fetchAllBooks(): Promise<Book[]> {
  const books: Book[] = []

  // Ordered by the primary key so pages can't overlap or skip rows —
  // without an explicit order the row order between requests is not
  // guaranteed, which silently corrupts a paged read.
  for (let page = 0; page < MAX_PAGES; page++) {
    const from = books.length
    const { data, error } = await supabase
      .from('books')
      .select(SELECT)
      .order('book_code')
      .range(from, from + PAGE_SIZE - 1)

    if (error) throw error
    if (!data || data.length === 0) return books

    // Advance by what actually came back, not by PAGE_SIZE: if the server
    // is configured with a lower cap than PAGE_SIZE, every page is short,
    // and treating "short page" as "last page" would truncate the catalog.
    books.push(...(data as BookRow[]).map(toBook))
  }

  throw new Error(
    `fetchBooks() stopped after ${MAX_PAGES} pages (${books.length} books) — the catalog query is not terminating.`,
  )
}
