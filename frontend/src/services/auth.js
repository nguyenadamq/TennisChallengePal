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

export async function signUp({ email, password, firstName, lastName, username, sex, ageGroup }) {
  assertStrongPassword(password)

  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        username: username.trim().toLowerCase(),
        sex,
        age_group: ageGroup,
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

export async function signIn(username, password) {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      username: username.trim().toLowerCase(),
      password,
    }),
  })

  const payload = await response.json()

  if (!response.ok) {
    throw new Error(payload?.error || 'Unable to log in.')
  }

  const { error } = await supabase.auth.setSession({
    access_token: payload.session.access_token,
    refresh_token: payload.session.refresh_token,
  })

  if (error) {
    throw error
  }

  return payload.session
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

export async function claimAdminRole() {
  throw new Error('Club officer roles are managed by each club president.')
}
