'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabaseClient'
import { signUp } from '../services/auth'

const initialForm = {
  displayName: '',
  username: '',
  email: '',
  password: '',
  gender: 'male',
}

const BLOCKED_USERNAME_PARTS = [
  'admin',
  'moderator',
  'support',
  'staff',
  'system',
  'root',
  'guest',
  'fuck',
  'shit',
  'bitch',
  'asshole',
  'bastard',
  'dick',
  'pussy',
  'cunt',
  'nigger',
  'nigga',
  'faggot',
  'retard',
  'slut',
  'whore',
  'rape',
  'rapist',
  'hitler',
  'nazi',
  'kkk',
]

export default function Signup() {
  const [form, setForm] = useState(initialForm)
  const [errorMessage, setErrorMessage] = useState('')
  const [infoMessage, setInfoMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    let active = true

    async function redirectIfLoggedIn() {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (active && session) {
        router.replace('/dashboard')
      }
    }

    redirectIfLoggedIn()

    return () => {
      active = false
    }
  }, [router])

  async function handleSubmit(event) {
    event.preventDefault()

    if (loading) {
      return
    }

    setLoading(true)
    setErrorMessage('')
    setInfoMessage('')

    const cleanedUsername = form.username
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '')

    if (
      cleanedUsername.length < 3 ||
      cleanedUsername.length > 24 ||
      /^\d+$/.test(cleanedUsername) ||
      cleanedUsername.startsWith('player_') ||
      BLOCKED_USERNAME_PARTS.some((value) => cleanedUsername.includes(value))
    ) {
      setLoading(false)
      setErrorMessage(
        'Choose a different username. Use 3-24 lowercase letters, numbers, or underscores, and avoid blocked words.',
      )
      return
    }

    try {
      const result = await signUp({ ...form, username: cleanedUsername })

      if (result.needsEmailConfirmation) {
        setInfoMessage(
          'Account created. Check your email for the confirmation link before logging in.',
        )
      } else {
        router.replace('/dashboard')
      }
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setLoading(false)
    }
  }

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  return (
    <main className="auth-shell">
      <section className="auth-hero">
        <p className="eyebrow">Player Onboarding</p>
        <h1>Build your ladder profile</h1>
        <p className="auth-copy">
          Your gender determines which ladders you can join. Men can appear on
          mens singles, mens doubles, and mixed doubles. Women can appear on
          womens singles, womens doubles, and mixed doubles.
        </p>
      </section>

      <section className="auth-card">
        <div>
          <p className="eyebrow">Join The Club</p>
          <h2>Create account</h2>
        </div>

        <form className="form-stack" onSubmit={handleSubmit}>
          <label>
            <span>Display name</span>
            <input
              value={form.displayName}
              onChange={(event) =>
                updateField('displayName', event.target.value)
              }
              placeholder="Alex Morgan"
              required
            />
          </label>

          <label>
            <span>Username</span>
            <input
              value={form.username}
              onChange={(event) =>
                updateField(
                  'username',
                  event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''),
                )
              }
              placeholder="alex_morgan"
              required
              minLength={3}
              maxLength={24}
            />
          </label>
          <p className="muted-text">
            Usernames must be unique and use 3-24 lowercase letters, numbers, or underscores.
          </p>

          <label>
            <span>Email</span>
            <input
              type="email"
              value={form.email}
              onChange={(event) => updateField('email', event.target.value)}
              placeholder="player@club.com"
              required
            />
          </label>

          <label>
            <span>Password</span>
            <input
              type="password"
              value={form.password}
              onChange={(event) => updateField('password', event.target.value)}
              placeholder="Create a strong password"
              required
              minLength={8}
            />
          </label>

          <label>
            <span>Gender</span>
            <select
              value={form.gender}
              onChange={(event) => updateField('gender', event.target.value)}
            >
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </label>

          {errorMessage ? <p className="form-error">{errorMessage}</p> : null}
          {infoMessage ? <p className="form-info">{infoMessage}</p> : null}

          <button className="primary-button" type="submit" disabled={loading}>
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <p className="auth-footnote">
          Already registered? <Link href="/login">Log in</Link>.
        </p>
      </section>
    </main>
  )
}
