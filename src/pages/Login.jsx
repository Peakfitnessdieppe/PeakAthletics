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
    console.log('handleSubmit fired')
    setError(null)
    setFormLoading(true)
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError) {
      setError(signInError.message)
    }
    setFormLoading(false)
  }

  const handleGoogleSignIn = async () => {
    setError(null)
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/card`,
      },
    })
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
          <div className="flex items-center gap-3 text-white/50 text-sm">
            <span className="flex-1 h-px bg-white/10" />
            <span>or</span>
            <span className="flex-1 h-px bg-white/10" />
          </div>
          <button
            type="button"
            onClick={handleGoogleSignIn}
            className="w-full bg-white text-black font-semibold py-3 rounded-lg hover:brightness-95 transition flex items-center justify-center gap-3"
          >
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.33 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.96 2.36-8.16 2.36-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.67 14.62 48 24 48z" />
              <path fill="none" d="M0 0h48v48H0z" />
            </svg>
            <span>Continue with Google</span>
          </button>
        </form>
      </div>
    </div>
  )
}

export default Login
