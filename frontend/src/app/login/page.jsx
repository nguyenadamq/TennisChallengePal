'use client'

import nextDynamic from 'next/dynamic'

export const dynamic = 'force-dynamic'

const Login = nextDynamic(() => import('../../features/LoginScreen'), {
  ssr: false,
  loading: () => <div className="app-loading">Loading Tennis Challenge Pal...</div>,
})

export default function LoginPage() {
  return <Login />
}
