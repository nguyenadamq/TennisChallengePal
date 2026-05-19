'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabaseClient'
import { signUp } from '../services/auth'

const initialForm = {
  firstName: '',
  lastName: '',
  username: '',
  email: '',
  password: '',
  confirmPassword: '',
  sex: 'man',
  ageGroup: 'adult',
}

const BLOCKED_USERNAME_PARTS = [
  'admin',
  'officer',
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

    const cleanedUsername = form.username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '')

    if (
      cleanedUsername.length < 3 ||
      cleanedUsername.length > 24 ||
      /^\d+$/.test(cleanedUsername) ||
      cleanedUsername.startsWith('player_') ||
      BLOCKED_USERNAME_PARTS.some((value) => cleanedUsername.includes(value))
    ) {
      setLoading(false)
      setErrorMessage(
        'Choose a different username. Use 3-24 lowercase letters, numbers, or underscores.',
      )
      return
    }

    if (form.password !== form.confirmPassword) {
      setLoading(false)
      setErrorMessage('Passwords must match.')
      return
    }

    try {
      const result = await signUp({ ...form, username: cleanedUsername })

      if (result.needsEmailConfirmation) {
        setInfoMessage('Account created. Confirm your email, then log in with your username.')
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
        <h1>Create your tennis profile</h1>
        <p className="auth-copy">
          Your profile powers exact username search, club rosters, ladder eligibility,
          and court invites.
        </p>
      </section>

      <section className="auth-card">
        <div>
          <p className="eyebrow">Register</p>
          <h2>Account details</h2>
        </div>

        <form className="form-stack" onSubmit={handleSubmit}>
          <div className="form-grid">
            <label>
              <span>First name</span>
              <input
                value={form.firstName}
                onChange={(event) => updateField('firstName', event.target.value)}
                placeholder="Alex"
                required
                maxLength={80}
                autoComplete="given-name"
              />
            </label>

            <label>
              <span>Last name</span>
              <input
                value={form.lastName}
                onChange={(event) => updateField('lastName', event.target.value)}
                placeholder="Morgan"
                required
                maxLength={80}
                autoComplete="family-name"
              />
            </label>
          </div>

          <label>
            <span>Username</span>
            <input
              value={form.username}
              onChange={(event) =>
                updateField('username', event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))
              }
              placeholder="alex_morgan"
              required
              minLength={3}
              maxLength={24}
              autoComplete="username"
            />
          </label>

          <label>
            <span>Email</span>
            <input
              type="email"
              value={form.email}
              onChange={(event) => updateField('email', event.target.value)}
              placeholder="player@example.com"
              required
              autoComplete="email"
            />
          </label>

          <div className="form-grid">
            <label>
              <span>Password</span>
              <input
                type="password"
                value={form.password}
                onChange={(event) => updateField('password', event.target.value)}
                placeholder="Create a strong password"
                required
                minLength={12}
                maxLength={128}
                autoComplete="new-password"
              />
            </label>

            <label>
              <span>Confirm password</span>
              <input
                type="password"
                value={form.confirmPassword}
                onChange={(event) => updateField('confirmPassword', event.target.value)}
                placeholder="Repeat password"
                required
                minLength={12}
                maxLength={128}
                autoComplete="new-password"
              />
            </label>
          </div>

          <div className="form-grid">
            <label>
              <span>Sex</span>
              <select value={form.sex} onChange={(event) => updateField('sex', event.target.value)}>
                <option value="man">Man</option>
                <option value="woman">Woman</option>
              </select>
            </label>

            <label>
              <span>Age group</span>
              <select
                value={form.ageGroup}
                onChange={(event) => updateField('ageGroup', event.target.value)}
              >
                <option value="high_school">High school</option>
                <option value="college">College</option>
                <option value="adult">Adult</option>
              </select>
            </label>
          </div>

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
