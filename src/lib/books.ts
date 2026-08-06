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
}

// TODO(team): implement this against the `books` + `copies` tables.
//
// Expected shape:
//   - Fetch every row from `books`, joined with its `copies` rows
//     (Supabase: `.from('books').select('*, copies(*)')`).
//   - Map each row to a `Book`:
//       - id            <- book_code
//       - year          <- year_published
//       - publisher     <- published_by
//       - keywords      <- tags, split on ',' and trimmed
//       - copiesTotal   <- copies.length
//       - copiesAvailable <- copies.filter(c => c.status === 'available').length
//   - Throw (or let the Supabase error propagate) on failure — the UI
//     already renders a "Couldn't load the catalog" state from a
//     rejected promise, so don't swallow errors here.
export async function fetchBooks(): Promise<Book[]> {
  void supabase
  throw new Error('fetchBooks() is not implemented yet — see TODO in src/lib/books.ts')
}
