import { createClient } from '@supabase/supabase-js'

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase server environment variables. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.',
  )
}

export function createServerSupabaseAuthClient() {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

export function createServerSupabaseUserClient(token) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

export async function requireUser(request) {
  const authorization = request.headers.get('authorization') || ''
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : null

  if (!token) {
    throw new Error('You must be logged in.')
  }

  const supabaseAuth = createServerSupabaseAuthClient()
  const {
    data: { user },
    error,
  } = await supabaseAuth.auth.getUser(token)

  if (error || !user) {
    throw new Error('Your session is invalid. Please log in again.')
  }

  return { user, token }
}

export async function requireProfile(request) {
  const { user, token } = await requireUser(request)
  const supabaseUser = createServerSupabaseUserClient(token)
  const { data: profile, error } = await supabaseUser
    .from('profiles')
    .select('id, display_name, username, gender, role')
    .eq('id', user.id)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!profile) {
    throw new Error('Profile not found for this account.')
  }

  return { user, profile, supabaseUser }
}
