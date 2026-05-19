'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabaseClient'
import { signIn } from '../services/auth'

const initialForm = {
  username: '',
  password: '',
}

export default function Login() {
  const [form, setForm] = useState(initialForm)
  const [errorMessage, setErrorMessage] = useState('')
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

    try {
      await signIn(form.username, form.password)
      router.replace('/dashboard')
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
        <p className="eyebrow">Welcome Back</p>
        <h1>Tennis Challenge Pal</h1>
        <p className="auth-copy">
          Sign in with your username to reach clubs, friends, court posts, and every ladder
          attached to your memberships.
        </p>
        <div className="hero-pills">
          <span>Mens Singles</span>
          <span>Mens Doubles</span>
          <span>Mixed Doubles</span>
          <span>Womens Singles</span>
          <span>Womens Doubles</span>
        </div>
      </section>

      <section className="auth-card">
        <div>
          <p className="eyebrow">Welcome Back</p>
          <h2>Log in</h2>
        </div>

        <form className="form-stack" onSubmit={handleSubmit}>
          <label>
            <span>Username</span>
            <input
              value={form.username}
              onChange={(event) =>
                updateField('username', event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))
              }
              placeholder="captain_12"
              required
              minLength={3}
              maxLength={24}
              autoComplete="username"
            />
          </label>

          <label>
            <span>Password</span>
            <input
              type="password"
              value={form.password}
              onChange={(event) => updateField('password', event.target.value)}
              placeholder="Password"
              required
              autoComplete="current-password"
            />
          </label>

          {errorMessage ? <p className="form-error">{errorMessage}</p> : null}

          <button className="primary-button" type="submit" disabled={loading}>
            {loading ? 'Logging in...' : 'Log in'}
          </button>
        </form>

        <p className="auth-footnote">
          Need an account? <Link href="/signup">Create one here</Link>.
        </p>
      </section>
    </main>
  )
}
