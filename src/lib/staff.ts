import { supabase } from './supabaseClient'

export type StaffDashboard = {
  traffic: Array<{ date: string; checkouts: number }>
  popularBooks: Array<{ bookCode: string; title: string; checkouts: number }>
  leastPopularBooks: Array<{ bookCode: string; title: string; checkouts: number }>
  activeHolds: Array<{ fullLabel: string; title: string; email: string; reservedUntil: string }>
  openCheckouts: Array<{ fullLabel: string; title: string; email: string; checkedOutAt: string }>
  inventory: Array<{ bookCode: string; title: string; totalCopies: number; availableCopies: number; heldCopies: number; checkedOutCopies: number }>
}

export type StaffAnalytics = {
  visitorTraffic: Array<{ date: string; visitors: number; pageViews: number }>
  categories: Array<{ category: string; books: number; checkouts: number }>
  inventoryTotals: { total: number; available: number; held: number; checkedOut: number }
  topAuthors: Array<{ author: string; checkouts: number }>
  activeSessions: number
  recentActivity: Array<{ time: string; title: string; copy: string; patron: string }>
}

export async function fetchStaffInventory(): Promise<StaffDashboard['inventory']> {
  const { data, error } = await supabase.rpc('staff_inventory')
  if (error) throw error
  return (data ?? []).map(row => ({
    bookCode: row.book_code,
    title: row.title,
    totalCopies: Number(row.total_copies),
    availableCopies: Number(row.available_copies),
    heldCopies: Number(row.held_copies),
    checkedOutCopies: Number(row.checked_out_copies),
  }))
}

export async function fetchStaffAnalytics(): Promise<StaffAnalytics> {
  const { data, error } = await supabase.rpc('staff_analytics')
  if (error) throw error
  return data as StaffAnalytics
}

export async function isCurrentUserStaff(): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_staff')
  if (error) throw error
  return data === true
}

export async function fetchStaffDashboard(): Promise<StaffDashboard> {
  const { data, error } = await supabase.rpc('staff_dashboard')
  if (error) throw error
  return data as StaffDashboard
}

export async function returnStaffCopy(fullLabel: string): Promise<void> {
  const { error } = await supabase.rpc('return_book', { p_full_label: fullLabel })
  if (error) throw error
}
