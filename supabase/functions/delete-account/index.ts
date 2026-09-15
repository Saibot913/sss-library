import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Same origin-handling fix as auth-email/index.ts: a single fixed
// APP_ORIGIN can't represent every dev environment this runs against
// (Conductor assigns a different port per workspace), so CORS was
// silently rejecting every dev origin except whichever one happened to
// match — the browser blocks the response before app code ever runs,
// which surfaces as a bare "Load failed", not a real error message.
// Accept any localhost/127.0.0.1 origin regardless of port, plus the
// exact configured APP_ORIGIN (the real production URL, once one
// exists).
const configuredOrigin = Deno.env.get('APP_ORIGIN') ?? 'http://localhost:3000'

function isDevOrigin(origin: string): boolean {
  try {
    const { hostname } = new URL(origin)
    return hostname === 'localhost' || hostname === '127.0.0.1'
  } catch {
    return false
  }
}

function resolveOrigin(requestOrigin: string | null): string {
  if (!requestOrigin) return configuredOrigin
  if (requestOrigin === configuredOrigin || isDevOrigin(requestOrigin)) return requestOrigin
  return configuredOrigin
}

Deno.serve(async request => {
  const allowedOrigin = resolveOrigin(request.headers.get('Origin'))
  const corsHeaders = {
    'Access-Control-Allow-Origin': allowedOrigin,
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

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const publishableKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const authorization = request.headers.get('Authorization')

  if (!supabaseUrl || !publishableKey || !serviceRoleKey || !authorization?.startsWith('Bearer ')) {
    return response({ error: 'You must be signed in to delete your account.' }, 401)
  }

  try {
    const userClient = createClient(supabaseUrl, publishableKey, {
      global: { headers: { Authorization: authorization } },
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data: userData, error: userError } = await userClient.auth.getUser()
    if (userError || !userData.user) return response({ error: 'Your session is no longer valid.' }, 401)

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { error: deleteError } = await admin.auth.admin.deleteUser(userData.user.id)
    if (deleteError) return response({ error: 'We could not delete your account.' }, 500)

    return response({ ok: true })
  } catch {
    return response({ error: 'We could not delete your account.' }, 500)
  }
})
