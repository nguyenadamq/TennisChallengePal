import { useEffect, useState } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { supabase } from './lib/supabaseClient'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Dashboard from './pages/Dashboard'
import './App.css'

function AuthRoute({ session, children }) {
  const location = useLocation()

  if (session === undefined) {
    return <div className="app-loading">Loading Tennis Challenge Pal...</div>
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return children
}

function GuestRoute({ session, children }) {
  if (session === undefined) {
    return <div className="app-loading">Loading Tennis Challenge Pal...</div>
  }

  if (session) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}

function App() {
  const [session, setSession] = useState()

  useEffect(() => {
    let active = true

    async function loadSession() {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession()

      if (active) {
        setSession(currentSession)
      }
    }

    loadSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  return (
    <Routes>
      <Route
        path="/"
        element={<Navigate to={session ? '/dashboard' : '/login'} replace />}
      />
      <Route
        path="/login"
        element={
          <GuestRoute session={session}>
            <Login />
          </GuestRoute>
        }
      />
      <Route
        path="/signup"
        element={
          <GuestRoute session={session}>
            <Signup />
          </GuestRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <AuthRoute session={session}>
            <Dashboard />
          </AuthRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
