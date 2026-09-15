import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// A single fixed APP_ORIGIN can't represent every environment this runs
// against: Conductor assigns a different port per workspace
// ($CONDUCTOR_PORT), and plain `pnpm dev` falls back to 8443 if PORT
// isn't set (see vite.config.ts). Locking CORS + the redirect target to
// one exact origin meant every dev workspace except whichever one
// happened to match APP_ORIGIN failed outright — the browser blocks the
// response before it ever reaches app code, which surfaces as a bare
// "Load failed"/"Failed to fetch", not a real error message.
//
// Fix: accept any localhost/127.0.0.1 origin regardless of port, in
// addition to the exact configured APP_ORIGIN (which should be the real
// production URL once one exists) — and use whichever origin actually
// made the request for both the CORS header and the magic link's
// redirect target, so the email link sends someone back to the same dev
// server that asked for it instead of a fixed one. A non-localhost,
// non-configured origin is still rejected outright.
const configuredOrigin = Deno.env.get('APP_ORIGIN') ?? 'http://localhost:3000'

function isDevOrigin(origin: string): boolean {
  try {
    const { hostname } = new URL(origin)
    return hostname === 'localhost' || hostname === '127.0.0.1'
  } catch {
    return false
  }
}

function resolveOrigin(requestOrigin: string | null): string | null {
  if (!requestOrigin) return configuredOrigin
  if (requestOrigin === configuredOrigin || isDevOrigin(requestOrigin)) return requestOrigin
  return null
}

const requestLog = new Map<string, number[]>()
const RATE_LIMIT = 8
const RATE_WINDOW_MS = 5 * 60 * 1000

Deno.serve(async request => {
  const requestOrigin = request.headers.get('Origin')
  const allowedOrigin = resolveOrigin(requestOrigin)

  const corsHeaders = {
    'Access-Control-Allow-Origin': allowedOrigin ?? configuredOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }

  function response(body: Record<string, unknown>, status = 200) {
    return new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return response({ error: 'Method not allowed.' }, 405)
  if (!allowedOrigin) return response({ error: 'Origin not allowed.' }, 403)

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
    const redirectTo = `${allowedOrigin}/profile?auth=${mode}`

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
