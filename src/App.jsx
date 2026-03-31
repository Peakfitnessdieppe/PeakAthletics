import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from './context/ThemeContext'
import { AuthProvider } from './context/AuthContext'
import RequireAuth from './components/auth/RequireAuth'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Card from './pages/Card'
import Session from './pages/Session'
import Admin from './pages/Admin'

const App = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <RequireAuth>
                <div />
              </RequireAuth>
            }
          />
          <Route
            path="/dashboard"
            element={
              <RequireAuth allowedRoles={['pfa_admin', 'pfa_staff', 'team_coach']}>
                <Dashboard />
              </RequireAuth>
            }
          />
          <Route
            path="/card"
            element={
              <RequireAuth allowedRoles={['athlete', 'family', 'pfa_admin', 'pfa_staff']}>
                <Card />
              </RequireAuth>
            }
          />
          <Route
            path="/session"
            element={
              <RequireAuth allowedRoles={['pfa_admin', 'pfa_staff']}>
                <Session />
              </RequireAuth>
            }
          />
          <Route
            path="/admin"
            element={
              <RequireAuth allowedRoles={['pfa_admin']}>
                <Admin />
              </RequireAuth>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App
