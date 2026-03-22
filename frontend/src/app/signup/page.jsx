'use client'

import nextDynamic from 'next/dynamic'

export const dynamic = 'force-dynamic'

const Signup = nextDynamic(() => import('../../features/SignupScreen'), {
  ssr: false,
  loading: () => <div className="app-loading">Loading Tennis Challenge Pal...</div>,
})

export default function SignupPage() {
  return <Signup />
}
