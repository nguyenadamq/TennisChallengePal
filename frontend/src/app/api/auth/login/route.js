import { NextResponse } from 'next/server'
import {
  createServerSupabaseAdminClient,
  createServerSupabaseAuthClient,
} from '../../../../lib/serverSupabase'
import { consumeRateLimit } from '../../../../lib/rateLimit'

const USERNAME_PATTERN = /^[a-z0-9_]{3,24}$/
const JSON_HEADERS = { 'Cache-Control': 'no-store' }

function json(body, status = 200, headers = {}) {
  return NextResponse.json(body, {
    status,
    headers: {
      ...JSON_HEADERS,
      ...headers,
    },
  })
}

function getClientAddress(request) {
  const forwardedFor = request.headers.get('x-forwarded-for')
  return forwardedFor?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown'
}

export async function POST(request) {
  try {
    const rateLimit = consumeRateLimit({
      key: `username-login:${getClientAddress(request)}`,
      limit: 12,
      windowMs: 10 * 60 * 1000,
    })

    if (!rateLimit.allowed) {
      return json(
        { error: 'Too many login attempts. Please wait and try again.' },
        429,
        { 'Retry-After': String(rateLimit.retryAfterSeconds) },
      )
    }

    const body = await request.json()
    const username = String(body?.username || '').trim().toLowerCase()
    const password = String(body?.password || '')

    if (!USERNAME_PATTERN.test(username) || !password) {
      return json({ error: 'Enter a valid username and password.' }, 400)
    }

    const supabaseAdmin = createServerSupabaseAdminClient()
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('email')
      .eq('username', username)
      .maybeSingle()

    if (profileError) {
      throw profileError
    }

    if (!profile?.email) {
      return json({ error: 'Invalid username or password.' }, 401)
    }

    const supabaseAuth = createServerSupabaseAuthClient()
    const { data, error } = await supabaseAuth.auth.signInWithPassword({
      email: profile.email,
      password,
    })

    if (error || !data.session) {
      return json({ error: 'Invalid username or password.' }, 401)
    }

    return json({
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at,
        user: data.user,
      },
    })
  } catch (error) {
    return json({ error: error.message || 'Unable to log in.' }, 400)
  }
}
