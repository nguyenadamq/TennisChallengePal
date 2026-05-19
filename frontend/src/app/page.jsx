'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../lib/supabaseClient'

export const dynamic = 'force-dynamic'

export default function HomePage() {
  const [hasSession, setHasSession] = useState(false)

  useEffect(() => {
    let active = true

    async function readSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (active) {
        setHasSession(Boolean(session))
      }
    }

    readSession()

    return () => {
      active = false
    }
  }, [])

  return (
    <main className="intro-shell">
      <section className="intro-copy">
        <p className="eyebrow">Tennis Challenge Pal</p>
        <h1>Club ladders, social play, and court plans in one login.</h1>
        <p>
          Create or join clubs, manage rankings with officers, find friends by exact username,
          and post courts to the right audience.
        </p>
        <div className="intro-actions">
          {hasSession ? (
            <Link className="primary-button link-button" href="/dashboard">
              Open dashboard
            </Link>
          ) : (
            <>
              <Link className="primary-button link-button" href="/signup">
                Register
              </Link>
              <Link className="secondary-button link-button" href="/login">
                Log in
              </Link>
            </>
          )}
        </div>
      </section>

      <section className="intro-visual" aria-label="Tennis court preview">
        <div className="court-asset">
          <div className="court-net" />
          <div className="court-service court-service-left" />
          <div className="court-service court-service-right" />
          <div className="court-baseline court-baseline-top" />
          <div className="court-baseline court-baseline-bottom" />
          <div className="court-marker court-marker-one" />
          <div className="court-marker court-marker-two" />
        </div>
      </section>
    </main>
  )
}
