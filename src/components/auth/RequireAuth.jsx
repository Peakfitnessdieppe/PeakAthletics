import React, { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import useAuth from '../../hooks/useAuth'

const homeRouteForRole = (role) => {
  switch (role) {
    case 'pfa_admin':
      return '/admin'
    case 'pfa_staff':
    case 'team_coach':
      return '/dashboard'
    case 'athlete':
    case 'family':
      return '/card'
    default:
      return '/admin'
  }
}

const Spinner = () => (
  <div className="min-h-screen flex items-center justify-center bg-[#0a0f0a] text-white">
    <div
      className="w-10 h-10 border-4 border-pfa-green border-t-transparent rounded-full animate-spin"
      aria-label="Loading"
    />
  </div>
)

const RequireAuth = ({ allowedRoles, children }) => {
  const { user, profile, loading } = useAuth()
  const location = useLocation()
  const [safetyCleared, setSafetyCleared] = useState(false)

  useEffect(() => {
    if (loading) {
      const timeout = setTimeout(() => setSafetyCleared(true), 3000)
      return () => clearTimeout(timeout)
    }
    setSafetyCleared(false)
  }, [loading])

  const role = profile?.role || (user ? 'pfa_admin' : undefined)
  const homeRoute = homeRouteForRole(role)
  const effectiveLoading = loading && !safetyCleared

  if (effectiveLoading) return <Spinner />

  if (!effectiveLoading && !user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (location.pathname === '/') {
    return <Navigate to={homeRoute} replace />
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to={homeRoute} replace />
  }

  return children
}

export default RequireAuth
