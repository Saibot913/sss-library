import { supabase } from './supabaseClient'

// Thin wrappers around the security-definer RPCs in
// 0016_staff_self_service_management.sql. Any staff member can add or
// remove any other staff member through these — a deliberate tradeoff,
// see that migration's comment for the two guardrails (can't remove
// yourself, can't remove the last remaining staff member) that guard
// against locking the library out of its own staff system.

export async function fetchStaffList(): Promise<string[]> {
  const { data, error } = await supabase.rpc('list_staff')
  if (error) throw error
  return (data ?? []).map((row: { email: string }) => row.email)
}

export async function addStaff(email: string): Promise<void> {
  const { error } = await supabase.rpc('add_staff', { p_email: email })
  if (error) throw error
}

export async function removeStaff(email: string): Promise<void> {
  const { error } = await supabase.rpc('remove_staff', { p_email: email })
  if (error) throw error
}
