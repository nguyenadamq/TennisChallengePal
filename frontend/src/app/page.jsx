'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabaseClient'

export const dynamic = 'force-dynamic'

export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    let active = true

    async function routeUser() {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!active) {
        return
      }

      router.replace(session ? '/dashboard' : '/login')
    }

    routeUser()

    return () => {
      active = false
    }
  }, [router])

  return <div className="app-loading">Loading Tennis Challenge Pal...</div>
}
