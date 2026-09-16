import { supabase } from './supabaseClient'

// Wraps the RPCs in supabase/migrations/0023_waitlist.sql. join_waitlist
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
