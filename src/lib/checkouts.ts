import { supabase } from './supabaseClient'

// ─── Types ──────────────────────────────────────────────────────────────────

export type ActiveReservation = {
  fullLabel: string
  bookCode: string
  bookTitle: string | null
  reservedUntil: string
}

export type ActiveCheckout = {
  checkoutId: string
  fullLabel: string
  bookCode: string
  bookTitle: string | null
  checkedOutAt: string
}

export type CheckoutHistoryRow = {
  checkoutId: string
  fullLabel: string
  bookCode: string
  bookTitle: string | null
  checkedOutAt: string
  returnedAt: string
}

export type StaffReservation = ActiveReservation & {
  reservedBy: string
  reservedByEmail: string | null
  reservedByName: string
  secondsRemaining: number
}

export type StaffCheckout = ActiveCheckout & {
  patronId: string
  patronEmail: string | null
  patronName: string
  daysOut: number
}

export type DashboardTraffic = {
  day: string
  checkouts: number
}

export type DashboardBookCount = {
  book_code: string
  title: string
  checkout_count: number
}

export type DashboardStats = {
  windowStart: string
  windowEnd: string
  totalCheckouts: number
  activeLoans: number
  traffic: DashboardTraffic[]
  topBooks: DashboardBookCount[]
  bottomBooks: DashboardBookCount[]
}

export type DashboardCategoryCount = {
  category: string
  checkout_count: number
}

export type DashboardLongOutstanding = {
  fullLabel: string
  bookCode: string
  bookTitle: string | null
  patronEmail: string | null
  patronName: string
  checkedOutAt: string
  daysOut: number
}

export type DashboardNeverCheckedOut = {
  book_code: string
  title: string
}

export type DashboardExtraStats = {
  avgCheckoutDays: number | null
  categoryBreakdown: DashboardCategoryCount[]
  longOutstanding: DashboardLongOutstanding[]
  activeHoldsCount: number
  uniquePatrons: number
  neverCheckedOut: DashboardNeverCheckedOut[]
}

// ─── Reservation + checkout primitives ──────────────────────────────────────
//
// All three map directly to the Postgres functions in
// supabase/migrations/0001_checkouts_and_reservations.sql. They enforce
// availability and the 5-minute hold in the database, so no extra
// client-side locking is needed.
//
// The caller must be signed in (see src/lib/auth.ts) — these all run as the
// current Supabase Auth user via auth.uid() on the database side.

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

// ─── Patron-side reads ─────────────────────────────────────────────────────
//
// These wrap the SECURITY DEFINER RPCs in 0008_patron_holds_and_loans.sql.
// A direct SELECT on copies is impossible for a patron because column-level
// grants (migration 0001 step 8) hide reserved_by/reserved_until; a direct
// SELECT on checkouts is allowed by RLS but the function keeps the join in
// one round trip and is resilient to RLS-shape changes.

export async function fetchMyActiveReservations(): Promise<ActiveReservation[]> {
  const { data, error } = await supabase.rpc('my_active_reservations')
  if (error) throw new Error(`my_active_reservations: ${error.message}`)
  return (data ?? []).map(toActiveReservation)
}

export async function fetchMyActiveCheckouts(): Promise<ActiveCheckout[]> {
  const { data, error } = await supabase.rpc('my_active_checkouts')
  if (error) throw new Error(`my_active_checkouts: ${error.message}`)
  return (data ?? []).map(toActiveCheckout)
}

export async function fetchMyCheckoutHistory(limit = 50): Promise<CheckoutHistoryRow[]> {
  const { data, error } = await supabase.rpc('my_checkout_history', { limit_count: limit })
  if (error) throw new Error(`my_checkout_history: ${error.message}`)
  return (data ?? []).map(toCheckoutHistoryRow)
}

// ─── Staff detection ──────────────────────────────────────────────────────

/**
 * Calls the `is_staff()` Postgres function. Cached per call only — onAuthChange
 * re-runs this from the dashboard when the user signs in or out, so caching
 * across auth changes would be a bug.
 */
export async function fetchIsStaff(): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_staff')
  if (error) {
    // is_staff() should never error for a signed-in user. If it does, the
    // safe default is "not staff" — the staff dashboard won't render, which
    // is correct.
    return false
  }
  return data === true
}

// ─── Staff-side reads + writes ─────────────────────────────────────────────

export async function fetchStaffReservations(): Promise<StaffReservation[]> {
  const { data, error } = await supabase.rpc('staff_list_reservations')
  if (error) throw error
  return (data ?? []).map((row: Record<string, unknown>) => ({
    fullLabel: row.full_label as string,
    bookCode: row.book_code as string,
    bookTitle: (row.book_title as string | null) ?? null,
    reservedBy: row.reserved_by as string,
    reservedByEmail: (row.reserved_by_email as string | null) ?? null,
    reservedByName: ((row.reserved_by_name as string | null) ?? '').trim() || 'Anonymous',
    reservedUntil: row.reserved_until as string,
    secondsRemaining: (row.seconds_remaining as number) ?? 0,
  }))
}

export async function fetchStaffCheckouts(): Promise<StaffCheckout[]> {
  const { data, error } = await supabase.rpc('staff_list_checkouts')
  if (error) throw error
  return (data ?? []).map((row: Record<string, unknown>) => ({
    checkoutId: row.checkout_id as string,
    fullLabel: row.full_label as string,
    bookCode: row.book_code as string,
    bookTitle: (row.book_title as string | null) ?? null,
    checkedOutAt: row.checked_out_at as string,
    patronId: row.patron_id as string,
    patronEmail: (row.patron_email as string | null) ?? null,
    patronName: ((row.patron_name as string | null) ?? '').trim() || 'Anonymous',
    daysOut: (row.days_out as number) ?? 0,
  }))
}

export async function fetchStaffDashboardStats(): Promise<DashboardStats> {
  const { data, error } = await supabase.rpc('staff_dashboard_stats')
  if (error) throw error
  const row = (data ?? {}) as Record<string, unknown>
  return {
    windowStart: (row.windowStart as string) ?? new Date().toISOString(),
    windowEnd: (row.windowEnd as string) ?? new Date().toISOString(),
    totalCheckouts: (row.totalCheckouts as number) ?? 0,
    activeLoans: (row.activeLoans as number) ?? 0,
    traffic: (row.traffic as DashboardTraffic[]) ?? [],
    topBooks: (row.topBooks as DashboardBookCount[]) ?? [],
    bottomBooks: (row.bottomBooks as DashboardBookCount[]) ?? [],
  }
}

export async function fetchStaffDashboardExtraStats(): Promise<DashboardExtraStats> {
  const { data, error } = await supabase.rpc('staff_dashboard_extra')
  if (error) throw error
  const row = (data ?? {}) as Record<string, unknown>
  const longOutstanding = ((row.longOutstanding as Array<Record<string, unknown>>) ?? []).map(item => ({
    fullLabel: item.full_label as string,
    bookCode: item.book_code as string,
    bookTitle: (item.book_title as string | null) ?? null,
    patronEmail: (item.patron_email as string | null) ?? null,
    patronName: ((item.patron_name as string | null) ?? '').trim() || 'Anonymous',
    checkedOutAt: item.checked_out_at as string,
    daysOut: (item.days_out as number) ?? 0,
  }))
  return {
    avgCheckoutDays: (row.avgCheckoutDays as number | null) ?? null,
    categoryBreakdown: (row.categoryBreakdown as DashboardCategoryCount[]) ?? [],
    longOutstanding,
    activeHoldsCount: (row.activeHoldsCount as number) ?? 0,
    uniquePatrons: (row.uniquePatrons as number) ?? 0,
    neverCheckedOut: (row.neverCheckedOut as DashboardNeverCheckedOut[]) ?? [],
  }
}

export async function staffReturnBook(fullLabel: string): Promise<{ checkoutId: string; returnedAt: string }> {
  const { data, error } = await supabase.rpc('staff_return_book', { p_full_label: fullLabel })
  if (error) throw error
  const arr = data as Array<{ checkout_id: string; returned_at: string }> | null
  const row = Array.isArray(arr) ? arr[0] : null
  if (!row) throw new Error('Return failed: no row returned.')
  return { checkoutId: row.checkout_id, returnedAt: row.returned_at }
}

export async function staffForceReleaseReservation(fullLabel: string): Promise<void> {
  const { error } = await supabase.rpc('staff_release_reservation', { p_full_label: fullLabel })
  if (error) throw error
}

// ─── Row mappers ───────────────────────────────────────────────────────────

type RawReservation = {
  full_label: string
  book_code: string
  book_title: string | null
  reserved_until: string
}

function toActiveReservation(row: RawReservation): ActiveReservation {
  return {
    fullLabel: row.full_label,
    bookCode: row.book_code,
    bookTitle: row.book_title,
    reservedUntil: row.reserved_until,
  }
}

type RawCheckout = {
  checkout_id: string
  full_label: string
  book_code: string
  book_title: string | null
  checked_out_at: string
}

function toActiveCheckout(row: RawCheckout): ActiveCheckout {
  return {
    checkoutId: row.checkout_id,
    fullLabel: row.full_label,
    bookCode: row.book_code,
    bookTitle: row.book_title,
    checkedOutAt: row.checked_out_at,
  }
}

function toCheckoutHistoryRow(row: RawCheckout & { returned_at: string }): CheckoutHistoryRow {
  return {
    checkoutId: row.checkout_id,
    fullLabel: row.full_label,
    bookCode: row.book_code,
    bookTitle: row.book_title,
    checkedOutAt: row.checked_out_at,
    returnedAt: row.returned_at,
  }
}

export type TopCheckedOutBook = {
  bookCode: string
  title: string
  checkoutCount: number
}

/**
 * Most checked-out books over a rolling 30-day window (not staff-only —
 * this powers the home page's "Recommended Books" section, visible to
 * every visitor). A rolling window rather than the strict calendar month
 * it's displayed as, so the list doesn't go empty for the first few days
 * of a new month before checkouts accumulate.
 */
export async function fetchTopCheckedOutBooks(limit = 3): Promise<TopCheckedOutBook[]> {
  const { data, error } = await supabase.rpc('home_top_checked_out_books', { p_limit: limit })
  if (error) throw error
  return ((data ?? []) as Array<{ book_code: string; title: string; checkout_count: number }>).map(row => ({
    bookCode: row.book_code,
    title: row.title,
    checkoutCount: row.checkout_count,
  }))
}
