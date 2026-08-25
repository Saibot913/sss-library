import { supabase } from './supabaseClient'

const SESSION_KEY = 'sss-library:analytics-session'

function getSessionId() {
  const existing = localStorage.getItem(SESSION_KEY)
  if (existing) return existing
  const created = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
  localStorage.setItem(SESSION_KEY, created)
  return created
}

export async function recordPageView(path: string): Promise<void> {
  const { error } = await supabase.rpc('record_page_view', {
    p_path: path.slice(0, 200),
    p_session_id: getSessionId(),
  })
  if (error) throw error
}
