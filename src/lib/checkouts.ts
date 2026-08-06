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
