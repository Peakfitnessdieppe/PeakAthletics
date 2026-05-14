import React, { useState } from 'react'
import { Navigate } from 'react-router-dom'
import useAuth from '../hooks/useAuth'
import { supabase } from '../services/supabase'

const SPORTS = ['Hockey', 'Soccer', 'Football', 'Ringette', 'Volleyball', 'Track & Field', 'Martial Arts', 'Other']

const POSITIONS_BY_SPORT = {
  Hockey: ['Center', 'Left Wing', 'Right Wing', 'Defense', 'Goalie'],
  Soccer: ['Goalkeeper', 'Defender', 'Midfielder', 'Forward'],
  Volleyball: ['Setter', 'Outside Hitter', 'Middle Blocker', 'Libero', 'Opposite Hitter'],
  Ringette: ['Center', 'Wing', 'Defense', 'Goalie'],
}
const DEFAULT_POSITIONS = ['Forward', 'Defense', 'Midfielder', 'Goalie', 'Other']
const getPositions = (sport) => POSITIONS_BY_SPORT[sport] || DEFAULT_POSITIONS

const AGE_CATEGORIES_BY_SPORT = {
  Hockey: ['U11', 'U13', 'U14', 'U15', 'U16', 'U18', 'U19', 'Junior', 'Senior'],
  Soccer: ['U13', 'U14', 'U15', 'U16', 'U17', 'U18', 'U19', 'University', 'Senior'],
  Volleyball: ['U14', 'U16', 'U18', 'University', 'Senior'],
}
const DEFAULT_AGE_CATEGORIES = ['U13', 'U14', 'U15', 'U16', 'U17', 'U18', 'U19', 'University', 'Senior']
const getAgeCategories = (sport) => AGE_CATEGORIES_BY_SPORT[sport] || DEFAULT_AGE_CATEGORIES

const COMPETITION_LEVELS = ['AAA', 'AA', 'A', 'Junior', 'University', 'Semi-Pro', 'Pro', 'Recreational']

const HOCKEY_TEAMS = [
  'Dieppe Flyers', 'Moncton Hawks', 'Northern Rivermen', 'Moncton Wildcats',
  'Moncton Rallye Motors Nissan Flyers', 'Fredericton Red Wings', 'Saint John Vito\'s',
  'Miramichi Timberwolves', 'Bathurst Titans', 'Campbellton Tigers',
]

const inputStyle = {
  width: '100%',
  background: '#0a0f0a',
  border: '1px solid rgba(63,174,82,0.3)',
  borderRadius: '8px',
  padding: '10px 14px',
  color: '#fff',
  fontSize: '14px',
  outline: 'none',
  boxSizing: 'border-box',
}

const labelStyle = {
  display: 'block',
  fontSize: '12px',
  fontWeight: '600',
  color: 'rgba(255,255,255,0.7)',
  marginBottom: '6px',
  letterSpacing: '0.04em',
}

const Login = () => {
  const { user, profile, loading } = useAuth()
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [formLoading, setFormLoading] = useState(false)

  const [regForm, setRegForm] = useState({
    full_name: '',
    date_of_birth: '',
    gender: '',
    sport: '',
    position: '',
    position_other: '',
    team_name: '',
    team_other: '',
    age_category: '',
    competition_level: '',
  })

  if (!loading && user && profile) {
    const routes = {
      pfa_admin: '/admin',
      pfa_staff: '/admin',
      team_coach: '/dashboard',
      athlete: '/card',
      family: '/card',
    }
    return <Navigate to={routes[profile.role] || '/dashboard'} replace />
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setError(null)
    setFormLoading(true)
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError) setError(signInError.message)
    setFormLoading(false)
  }

  const handleGoogleSignIn = async () => {
    setError(null)
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/card` },
    })
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    setError(null)
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (!regForm.full_name || !regForm.date_of_birth || !regForm.gender || !regForm.sport || !regForm.age_category || !regForm.competition_level) {
      setError('Please fill in all required fields.')
      return
    }
    setFormLoading(true)
    const finalPosition = regForm.position === 'Other' ? regForm.position_other : regForm.position
    try {
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: regForm.full_name,
            date_of_birth: regForm.date_of_birth,
            gender: regForm.gender,
            sport: regForm.sport,
            position: finalPosition,
            age_category: regForm.age_category,
            competition_level: regForm.competition_level,
          }
        }
      })
      if (signUpError) throw signUpError

      const userId = authData?.user?.id
      if (!userId) throw new Error('Registration failed — no user ID returned.')

      const { error: profileError } = await supabase.from('profiles').upsert({
        id: userId,
        email,
        full_name: regForm.full_name,
        date_of_birth: regForm.date_of_birth,
        gender: regForm.gender,
        sport: regForm.sport,
        position: finalPosition,
        age_category: regForm.age_category,
        competition_level: regForm.competition_level,
        role: 'athlete',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      if (profileError) throw profileError

      setSuccess('Registration successful! Please check your email to confirm your account, then sign in.')
      setMode('login')
      setEmail('')
      setPassword('')
      setConfirmPassword('')
    } catch (err) {
      setError(err.message)
    }
    setFormLoading(false)
  }

  const reg = (field) => ({
    value: regForm[field],
    onChange: (e) => setRegForm((prev) => ({ ...prev, [field]: e.target.value })),
  })

  const positions = getPositions(regForm.sport)
  const ageCategories = getAgeCategories(regForm.sport)

  return (
    <div style={{ minHeight: '100vh', background: '#0a0f0a', color: '#fff', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 16px' }}>
      <div style={{ width: '100%', maxWidth: '480px' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <img
            src="https://iilysafrbbnklelzzqyh.supabase.co/storage/v1/object/public/Assets/Peak%20Athletics%20Logo%202.png"
            alt="Peak Fitness Athletics"
            style={{ height: '240px', width: 'auto', maxWidth: '480px', margin: '0 auto 16px', display: 'block', filter: 'drop-shadow(0 0 10px rgba(63,174,82,0.4))' }}
          />
          <div style={{ fontSize: '20px', fontWeight: '800', letterSpacing: '0.15em', color: '#3fae52' }}>PEAK FITNESS ATHLETICS</div>
          <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginTop: '4px' }}>Performance Testing Platform</div>
        </div>

        {/* Tab Toggle */}
        <div style={{ display: 'flex', background: '#0d1a0e', border: '1px solid rgba(63,174,82,0.2)', borderRadius: '10px', padding: '4px', marginBottom: '24px' }}>
          {['login', 'register'].map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); setError(null); setSuccess(null) }}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                fontWeight: '700',
                fontSize: '13px',
                letterSpacing: '0.06em',
                background: mode === m ? '#3fae52' : 'transparent',
                color: mode === m ? '#000' : 'rgba(255,255,255,0.5)',
                transition: 'all 0.2s ease',
              }}
            >
              {m === 'login' ? 'Sign In' : 'Register'}
            </button>
          ))}
        </div>

        {success && (
          <div style={{ background: 'rgba(63,174,82,0.1)', border: '1px solid rgba(63,174,82,0.3)', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', color: '#3fae52', fontSize: '13px' }}>
            {success}
          </div>
        )}

        {error && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', color: '#f87171', fontSize: '13px' }}>
            {error}
          </div>
        )}

        {/* Card */}
        <div style={{ background: '#0d1a0e', border: '1px solid rgba(63,174,82,0.2)', borderRadius: '14px', padding: '28px' }}>

          {mode === 'login' ? (
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Password</label>
                <input type="password" id="password" value={password} onChange={(e) => setPassword(e.target.value)} required style={inputStyle} />
              </div>
              <button
                type="submit"
                disabled={formLoading}
                style={{ width: '100%', background: '#3fae52', color: '#000', fontWeight: '800', padding: '12px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '14px', letterSpacing: '0.06em', opacity: formLoading ? 0.6 : 1 }}
              >
                {formLoading ? 'Signing In...' : 'Sign In'}
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>
                <span style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }} />
                <span>or</span>
                <span style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }} />
              </div>
              <button
                type="button"
                onClick={handleGoogleSignIn}
                style={{ width: '100%', background: '#fff', color: '#000', fontWeight: '600', padding: '12px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
              >
                <svg width="18" height="18" viewBox="0 0 48 48">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.33 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.96 2.36-8.16 2.36-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.67 14.62 48 24 48z" />
                </svg>
                Continue with Google
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              <div style={{ background: 'rgba(63,174,82,0.06)', border: '1px solid rgba(63,174,82,0.15)', borderRadius: '8px', padding: '12px 14px', fontSize: '12px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>
                If the athlete is under 18, use a parent or guardian's email. This email will be used to log in to the PFA Performance App.
              </div>

              <div>
                <label style={labelStyle}>Email <span style={{ color: '#ef4444' }}>*</span></label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={inputStyle} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Password <span style={{ color: '#ef4444' }}>*</span></label>
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required style={inputStyle} placeholder="Min 8 characters" />
                </div>
                <div>
                  <label style={labelStyle}>Confirm Password <span style={{ color: '#ef4444' }}>*</span></label>
                  <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required style={inputStyle} />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Athlete Full Name <span style={{ color: '#ef4444' }}>*</span></label>
                <input type="text" {...reg('full_name')} required style={inputStyle} placeholder="First and last name — used in reports" />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Date of Birth <span style={{ color: '#ef4444' }}>*</span></label>
                  <input type="date" {...reg('date_of_birth')} required style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Gender <span style={{ color: '#ef4444' }}>*</span></label>
                  <select {...reg('gender')} required style={inputStyle}>
                    <option value="">Select...</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Sport <span style={{ color: '#ef4444' }}>*</span></label>
                  <select {...reg('sport')} required style={inputStyle}>
                    <option value="">Select...</option>
                    {SPORTS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Position <span style={{ color: '#ef4444' }}>*</span></label>
                  <select {...reg('position')} required style={inputStyle}>
                    <option value="">Select...</option>
                    {positions.map((p) => <option key={p} value={p}>{p}</option>)}
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              {regForm.position === 'Other' && (
                <div>
                  <label style={labelStyle}>Position (specify)</label>
                  <input type="text" {...reg('position_other')} style={inputStyle} placeholder="Enter your position" />
                </div>
              )}

              <div>
                <label style={labelStyle}>Team Name <span style={{ color: '#ef4444' }}>*</span></label>
                <select {...reg('team_name')} required style={inputStyle}>
                  <option value="">Select...</option>
                  {HOCKEY_TEAMS.map((t) => <option key={t} value={t}>{t}</option>)}
                  <option value="Other">Other / Not Listed</option>
                </select>
              </div>

              {regForm.team_name === 'Other' && (
                <div>
                  <label style={labelStyle}>Team Name (specify)</label>
                  <input type="text" {...reg('team_other')} style={inputStyle} placeholder="Enter your team name" />
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Age Category <span style={{ color: '#ef4444' }}>*</span></label>
                  <select {...reg('age_category')} required style={inputStyle}>
                    <option value="">Select...</option>
                    {ageCategories.map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Competition Level <span style={{ color: '#ef4444' }}>*</span></label>
                  <select {...reg('competition_level')} required style={inputStyle}>
                    <option value="">Select...</option>
                    {COMPETITION_LEVELS.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={formLoading}
                style={{ width: '100%', background: '#3fae52', color: '#000', fontWeight: '800', padding: '12px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '14px', letterSpacing: '0.06em', marginTop: '8px', opacity: formLoading ? 0.6 : 1 }}
              >
                {formLoading ? 'Creating Account...' : 'Create Account'}
              </button>

              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', textAlign: 'center', lineHeight: 1.6 }}>
                By registering, your profile will be created and made available to Peak Fitness Athletics coaching staff. For support, contact <span style={{ color: '#3fae52' }}>info@peakfitnessdieppe.ca</span>
              </div>

            </form>
          )}
        </div>
      </div>
    </div>
  )
}

export default Login
