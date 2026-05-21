import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../services/supabase'

const inputStyle = {
  width: '100%',
  background: '#0a0f0a',
  border: '1px solid rgba(63,174,82,0.3)',
  borderRadius: '10px',
  padding: '12px 14px',
  color: '#fff',
  fontSize: '14px',
  boxSizing: 'border-box',
  outline: 'none',
}

const labelStyle = {
  display: 'block',
  fontSize: '12px',
  fontWeight: '700',
  color: 'rgba(255,255,255,0.7)',
  marginBottom: '6px',
  letterSpacing: '0.05em',
}

const ResetPassword = () => {
  const navigate = useNavigate()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Supabase processes hash on load; ensure session is resolved
    supabase.auth.getSession().catch(() => {})
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (!newPassword || !confirmPassword) {
      setError('Please enter and confirm your new password.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
    setLoading(false)
    if (updateError) {
      setError(updateError.message)
      return
    }
    setSuccess('Password set! Redirecting to your profile...')
    setTimeout(() => navigate('/card', { replace: true }), 2000)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0f0a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 16px' }}>
      <div style={{ width: '100%', maxWidth: '460px', background: '#0d1a0e', border: '1px solid rgba(63,174,82,0.2)', borderRadius: '16px', padding: '28px', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <img src="/logos/pfa_logo.png" alt="Peak Fitness Athletics" width="100" style={{ marginBottom: '10px' }} />
          <div style={{ fontSize: '18px', fontWeight: '800', letterSpacing: '0.12em', color: '#3fae52' }}>Reset Password</div>
          <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', marginTop: '4px' }}>Set a new password to access your profile.</div>
        </div>

        {error && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', padding: '12px 14px', marginBottom: '14px', color: '#f87171', fontSize: '13px' }}>
            {error}
          </div>
        )}
        {success && (
          <div style={{ background: 'rgba(63,174,82,0.1)', border: '1px solid rgba(63,174,82,0.3)', borderRadius: '10px', padding: '12px 14px', marginBottom: '14px', color: '#3fae52', fontSize: '13px' }}>
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={labelStyle}>New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              style={inputStyle}
              required
            />
          </div>
          <div>
            <label style={labelStyle}>Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              style={inputStyle}
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            style={{ width: '100%', background: '#3fae52', color: '#0a0f0a', fontWeight: '800', padding: '12px', borderRadius: '10px', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '14px', letterSpacing: '0.05em', opacity: loading ? 0.7 : 1 }}
          >
            {loading ? 'Saving...' : 'Save New Password'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default ResetPassword
