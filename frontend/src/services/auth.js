import { supabase } from '../lib/supabaseClient'

function delay(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

async function fetchProfileOnce(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, display_name, username, gender, role, created_at')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data
}

export async function signUp({ email, password, displayName, username, gender }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: displayName.trim(),
        username: username.trim().toLowerCase(),
        gender,
      },
    },
  })

  if (error) {
    throw error
  }

  if (data.session?.user?.id) {
    await waitForProfile(data.session.user.id)
  }

  return {
    session: data.session,
    needsEmailConfirmation: !data.session,
  }
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    throw error
  }

  return data.session
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()

  if (error) {
    throw error
  }
}

export async function getProfile(userId) {
  const profile = await fetchProfileOnce(userId)

  if (!profile) {
    throw new Error('Profile not found for this account.')
  }

  return profile
}

export async function waitForProfile(userId, attempts = 8) {
  for (let index = 0; index < attempts; index += 1) {
    const profile = await fetchProfileOnce(userId)

    if (profile) {
      return profile
    }

    await delay(250)
  }

  throw new Error(
    'Your account was created, but your profile is still syncing. Please wait a moment and log in again.',
  )
}

export async function claimAdminRole(password) {
  const { error } = await supabase.rpc('claim_admin_role', {
    p_password: password,
  })

  if (error) {
    throw error
  }
}
