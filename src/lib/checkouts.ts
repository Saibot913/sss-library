import { supabase } from './supabaseClient'

// TODO(team): wire these into the cart / checkout flow in App.tsx.
//
// The cart currently tracks `book.id` (book_code) in local state
// (addToCart/removeFromCart, App.tsx ~line 1290), but reservations and
// checkouts operate on a specific *copy* (full_label) — a book can have
// several copies. Adding a book to cart needs to pick one available
// copy (e.g. the first with status 'available' from `book.copies`) and
// call reserveCopy() with its full_label; removing from cart should
// call releaseReservation(). "Complete checkout" should call
// checkoutBook() for each reserved copy.
//
// All three map directly to the Postgres functions in
// supabase/migrations/0001_checkouts_and_reservations.sql — they
// enforce availability and the 5-minute hold in the database, so no
// extra client-side locking is needed.
//
// The caller must be signed in (see src/lib/auth.ts) — these all run
// as the current Supabase Auth user via auth.uid() on the database side.

export async function reserveCopy(fullLabel: string): Promise<void> {
  const { error } = await supabase.rpc('reserve_copy', { p_full_label: fullLabel })
  if (error) throw error
}

export async function releaseReservation(fullLabel: string): Promise<void> {
  const { error } = await supabase.rpc('release_reservation', { p_full_label: fullLabel })
  if (error) throw error
}

export async function checkoutBook(fullLabel: string): Promise<void> {
  const { error } = await supabase.rpc('checkout_book', { p_full_label: fullLabel })
  if (error) throw error
}

/**
 * Check out any available copy of a book, given its `book_code`.
 *
 * The cart tracks books, but checkout_book() operates on a specific copy, so
 * something has to choose one. Doing it here rather than from the cached
 * catalog matters: `Book.copiesAvailable` comes from a five-minute cache and
 * carries no copy labels, and a copy sitting in someone else's cart still
 * reads as available because the hold lives in `reserved_until`, which column
 * grants hide from the client. So the only reliable answer is to ask at the
 * moment of checkout.
 *
 * Several candidates are fetched rather than one, because checkout_book()
 * re-checks atomically and will reject a copy someone else took in the
 * meantime. Trying the next one turns a lost race into a retry instead of an
 * error the patron has to understand.
 *
 * Returns the copy that was actually checked out.
 */
export async function checkoutBookByCode(bookCode: string): Promise<string> {
  const { data, error } = await supabase
    .from('copies')
    .select('full_label')
    .eq('book_code', bookCode)
    .eq('status', 'available')
    .limit(5)

  if (error) throw error
  const candidates = data ?? []
  if (candidates.length === 0) {
    throw new Error('No copies of this book are available right now.')
  }

  let lastError: unknown = null
  for (const copy of candidates) {
    try {
      await checkoutBook(copy.full_label)
      return copy.full_label
    } catch (err) {
      lastError = err
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error('Someone else took the last copy while you were checking out.')
}
