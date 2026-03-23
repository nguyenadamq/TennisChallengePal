'use client'

import nextDynamic from 'next/dynamic'

export const dynamic = 'force-dynamic'

const Dashboard = nextDynamic(() => import('../../features/DashboardScreen'), {
  ssr: false,
  loading: () => <div className="app-loading">Loading Challenge Court...</div>,
})

export default function DashboardPage() {
  return <Dashboard />
}
