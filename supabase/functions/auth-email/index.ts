import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const appOrigin = Deno.env.get('APP_ORIGIN') ?? 'http://localhost:3000'
const corsHeaders = {
  'Access-Control-Allow-Origin': appOrigin,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const requestLog = new Map<string, number[]>()
const RATE_LIMIT = 8
const RATE_WINDOW_MS = 5 * 60 * 1000

function response(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return response({ error: 'Method not allowed.' }, 405)

  const origin = request.headers.get('Origin')
  if (origin && origin !== appOrigin) return response({ error: 'Origin not allowed.' }, 403)

  const address = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const now = Date.now()
  const recentRequests = (requestLog.get(address) ?? []).filter(time => now - time < RATE_WINDOW_MS)
  if (recentRequests.length >= RATE_LIMIT) return response({ error: 'Too many requests. Please try again later.' }, 429)
  recentRequests.push(now)
  requestLog.set(address, recentRequests)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const publishableKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
    return response({ error: 'Auth service is not configured.' }, 500)
  }

  try {
    const body = await request.json() as { email?: unknown; mode?: unknown }
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const mode = body.mode === 'signup' ? 'signup' : body.mode === 'login' ? 'login' : ''
    const redirectTo = `${appOrigin}/profile?auth=${mode}`

    if (!email || email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !mode) return response({ error: 'Enter a valid email address.' }, 400)

    if (mode === 'signup') {
      // inviteUserByEmail creates the auth.users row and sends the invite.
      // The 0004 handle_new_user_profile trigger then creates a matching
      // `profiles` row, and nothing else — staff membership is a separate,
      // admin-managed table (see migration 0002), and is intentionally not
      // granted on signup. A new account is just a regular patron.
      const admin = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
      const { error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo })
      if (error) return response({ error: error.message }, 400)
    } else {
      const auth = createClient(supabaseUrl, publishableKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
      const { error } = await auth.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false, emailRedirectTo: redirectTo },
      })
      if (error) return response({ error: error.message }, 400)
    }

    return response({ ok: true })
  } catch {
    return response({ error: 'Invalid auth request.' }, 400)
  }
})
