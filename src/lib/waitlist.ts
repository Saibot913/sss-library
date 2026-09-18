import { supabase } from './supabaseClient'

// Wraps the RPCs in supabase/migrations/0024_waitlist.sql. join_waitlist
// reads the patron's name/email/phone from their own `profiles` row
// server-side, so nothing needs to be passed from the client here.

export async function joinWaitlist(bookCode: string): Promise<void> {
  const { error } = await supabase.rpc('join_waitlist', { p_book_code: bookCode })
  if (error) throw error
}

export async function leaveWaitlist(bookCode: string): Promise<void> {
  const { error } = await supabase.rpc('leave_waitlist', { p_book_code: bookCode })
  if (error) throw error
}

export async function checkIsOnWaitlist(bookCode: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_on_waitlist', { p_book_code: bookCode })
  if (error) throw error
  return data === true
}

// ─── Staff: manual "Ready for Pickup" notification ─────────────────────────
// Wraps the RPCs in supabase/migrations/0030_staff_waitlist_ready.sql. No
// automated email — staff sees contact info here and reaches out directly.

export type ReadyWaitlistEntry = {
  waitlistId: string
  bookCode: string
  bookTitle: string | null
  email: string
  firstName: string
  lastName: string
  phone: string
  joinedAt: string
}

export async function fetchStaffReadyWaitlist(): Promise<ReadyWaitlistEntry[]> {
  const { data, error } = await supabase.rpc('staff_list_ready_waitlist')
  if (error) throw error
  const rows = (data ?? []) as Array<{
    waitlist_id: string
    book_code: string
    book_title: string | null
    email: string
    first_name: string
    last_name: string
    phone: string
    joined_at: string
  }>
  return rows.map(row => ({
    waitlistId: row.waitlist_id,
    bookCode: row.book_code,
    bookTitle: row.book_title,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    phone: row.phone,
    joinedAt: row.joined_at,
  }))
}

export async function staffRemoveWaitlistEntry(waitlistId: string): Promise<void> {
  const { error } = await supabase.rpc('staff_remove_waitlist_entry', { p_waitlist_id: waitlistId })
  if (error) throw error
}
