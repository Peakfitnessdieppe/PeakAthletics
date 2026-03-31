import React, { useState } from 'react'
import { Navigate } from 'react-router-dom'
import useAuth from '../hooks/useAuth'
import { supabase } from '../services/supabase'

const Login = () => {
  const { user, profile, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [formLoading, setFormLoading] = useState(false)

  if (!loading && user && profile) {
    const routes = {
      pfa_admin: '/admin',
      pfa_staff: '/dashboard',
      team_coach: '/dashboard',
      athlete: '/card',
      family: '/card',
    }
    return <Navigate to={routes[profile.role] || '/admin'} replace />
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setFormLoading(true)
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError) {
      setError(signInError.message)
    }
    setFormLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0f0a] text-white">
      <div className="w-full max-w-md space-y-6 px-8 py-10 rounded-2xl border border-pfa-border bg-[#0d1a0e] shadow-lg">
        <div className="space-y-2 text-center">
          <div className="text-2xl font-extrabold tracking-[0.2em] text-pfa-green">PEAK FITNESS ATHLETICS</div>
          <div className="text-sm text-white/70">Performance Testing Platform</div>
        </div>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="text-sm text-white/80" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-lg bg-[#0a0f0a] border border-pfa-border px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-pfa-green"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-white/80" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-lg bg-[#0a0f0a] border border-pfa-border px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-pfa-green"
            />
          </div>
          {error && <div className="text-red-400 text-sm">{error}</div>}
          <button
            type="submit"
            disabled={formLoading}
            className="w-full bg-pfa-green text-black font-bold py-3 rounded-lg hover:brightness-110 transition disabled:opacity-60"
          >
            {formLoading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default Login
