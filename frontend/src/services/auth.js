import { supabase } from '../lib/supabaseClient'
import { apiRequest } from '../lib/apiClient'

function assertStrongPassword(password) {
  if (typeof password !== 'string' || password.length < 12) {
    throw new Error('Use a password with at least 12 characters.')
  }

  if (
    !/[a-z]/.test(password) ||
    !/[A-Z]/.test(password) ||
    !/\d/.test(password)
  ) {
    throw new Error('Use a stronger password with uppercase, lowercase, and a number.')
  }
}

function delay(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

async function fetchProfileOnce() {
  try {
    const result = await apiRequest('/api/profile')
    return result.profile
  } catch (error) {
    if (error.message === 'Profile not found for this account.') {
      return null
    }

    throw error
  }
}

export async function signUp({ email, password, displayName, username, gender }) {
  assertStrongPassword(password)

  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
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
    email: email.trim(),
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

export async function getProfile(_userId) {
  const profile = await fetchProfileOnce()

  if (!profile) {
    throw new Error('Profile not found for this account.')
  }

  return profile
}

export async function waitForProfile(_userId, attempts = 8) {
  for (let index = 0; index < attempts; index += 1) {
    const profile = await fetchProfileOnce()

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
  await apiRequest('/api/rpc', {
    method: 'POST',
    body: JSON.stringify({
      functionName: 'claim_admin_role',
      payload: { p_password: password },
    }),
  })
}
