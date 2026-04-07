import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useAuth from '../hooks/useAuth'
import CardLayout from '../components/layout/CardLayout'
import { supabase } from '../services/supabase'
import { getLatestResults, getBaselineResults } from '../services/testResults'

const categories = [
  { key: 'speed', label: 'Speed' },
  { key: 'strength', label: 'Strength' },
  { key: 'power', label: 'Power' },
  { key: 'agility', label: 'Agility' },
  { key: 'endurance', label: 'Endurance' },
]

const cardNumber = '#001'

const Card = () => {
  const navigate = useNavigate()
  const { user, profile, signOut } = useAuth()
  const [flipped, setFlipped] = useState(false)
  const [loading, setLoading] = useState(true)
  const [latestResults, setLatestResults] = useState([])
  const [baselineResults, setBaselineResults] = useState([])
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef(null)
  const [checkedInToday, setCheckedInToday] = useState(false)

  const todayStr = () => new Date().toISOString().split('T')[0]

  const fetchResults = async () => {
    if (!profile?.id) return
    setLoading(true)
    try {
      const [latest, baseline] = await Promise.all([
        getLatestResults(profile.id),
        getBaselineResults(profile.id),
      ])
      setLatestResults(latest || [])
      setBaselineResults(baseline || [])
      console.log('[Card] profile:', profile)
      console.log('[Card] latest results:', latest)
    } catch (err) {
      console.error('Failed to load results', err)
    }
    setLoading(false)
  }

  const convertForBar = (testType, value) => {
    if (value === null || value === undefined) return null
    const kgTests = ['squat', 'trap_bar_deadlift', 'bench_press', 'imtp']
    if (kgTests.includes(testType)) return value * 2.205
    const cmToM = ['broad_jump']
    if (cmToM.includes(testType)) return value
    return value
  }

  const formatValue = (testType, value) => {
    if (value === null || value === undefined) return '—'

    const kgTests = ['squat', 'trap_bar_deadlift', 'bench_press', 'imtp']
    if (kgTests.includes(testType)) {
      return parseFloat(value).toFixed(1)
    }

    const cmToM = ['broad_jump']
    if (cmToM.includes(testType)) {
      return (value / 100).toFixed(2)
    }

    const twoDecimal = ['10m_sprint', '30m_sprint', 'pro_agility_shuttle']
    if (twoDecimal.includes(testType)) {
      return Number(value).toFixed(2)
    }

    const wholeNumber = ['vertical_jump', 'ncmj']
    if (wholeNumber.includes(testType)) {
      return Math.round(value)
    }

    if (testType === 'beep_test') {
      return Number(value).toFixed(1)
    }

    return parseFloat(Number(value).toFixed(1))
  }

  const TEST_MAX = {
    '10m_sprint': 3.5,
    '30m_sprint': 6.0,
    squat: 400,
    trap_bar_deadlift: 500,
    bench_press: 350,
    pull_ups: 30,
    push_ups: 60,
    imtp: 400,
    broad_jump: 350,
    vertical_jump: 100,
    ncmj: 80,
    mb_chest_pass: 8,
    pro_agility_shuttle: 6.0,
    beep_test: 15,
  }

  const getBarWidth = (testType, value, higherIsBetter = true) => {
    if (value === null || value === undefined) return 0
    const max = TEST_MAX[testType] || 100
    if (!higherIsBetter) {
      return Math.min(100, Math.max(0, ((max - value) / max) * 100))
    }
    return Math.min(100, Math.max(0, (value / max) * 100))
  }

  const findResult = (ids) => latestResults.find((r) => ids.includes(r.test_type))

  const quickStats = [
    { id: 'speed', label: '10m Sprint', result: findResult(['10m_sprint']) || findResult(['30m_sprint']) },
    { id: 'vert', label: 'Vertical Jump', result: findResult(['vertical_jump']) },
    { id: 'broad', label: 'Broad Jump', result: findResult(['broad_jump']) },
    { id: 'agility', label: 'Pro Agility', result: findResult(['pro_agility_shuttle']) },
  ]

  useEffect(() => {
    fetchResults()
  }, [profile?.id])

  useEffect(() => {
    const fetchCheckinStatus = async () => {
      if (!profile?.id) return
      try {
        const { data, error } = await supabase
          .from('athlete_checkins')
          .select('id')
          .eq('athlete_id', profile.id)
          .eq('checkin_date', todayStr())
          .maybeSingle()
        if (error && error.code !== 'PGRST116') throw error
        setCheckedInToday(!!data)
      } catch (err) {
        console.error('Check-in status error', err)
      }
    }
    fetchCheckinStatus()
  }, [profile?.id])

  useEffect(() => {
    setAvatarUrl(profile?.avatar_url || null)
  }, [profile?.avatar_url])

  const initials = useMemo(() => {
    if (!profile?.full_name) return 'NA'
    return profile.full_name
      .split(' ')
      .map((p) => p[0])
      .join('')
      .slice(0, 2)
      .toUpperCase()
  }, [profile?.full_name])

  const groupedResults = useMemo(() => {
    const map = {
      speed: [],
      strength: [],
      power: [],
      agility: [],
      endurance: [],
    }
    latestResults.forEach((r) => {
      if (map[r.category]) map[r.category].push(r)
    })
    return map
  }, [latestResults])

  const mostRecentDate = latestResults?.[0]?.date_tested || baselineResults?.[0]?.date_tested || null

  const uploadPhoto = async (file) => {
    if (!file || !profile?.id) return
    setUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `${profile.id}/avatar.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('Athlete Photos')
        .upload(path, file, { upsert: true })
      if (uploadError) throw uploadError
      const {
        data: { publicUrl },
      } = supabase.storage.from('Athlete Photos').getPublicUrl(path)
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
        .eq('id', profile.id)
      if (profileError) throw profileError
      setAvatarUrl(publicUrl)
      await fetchResults()
    } catch (err) {
      console.error('Upload failed', err)
    }
    setUploading(false)
  }

  const onFileChange = (e) => {
    const file = e.target.files?.[0]
    if (file) uploadPhoto(file)
  }

  const renderCorner = (position) => (
    <span
      className={`absolute w-5 h-5 border-[1.5px] border-[#c9a227] ${
        position === 'tl'
          ? 'top-2 left-2 border-r-0 border-b-0'
          : position === 'tr'
          ? 'top-2 right-2 border-l-0 border-b-0'
          : position === 'bl'
          ? 'bottom-2 left-2 border-r-0 border-t-0'
          : 'bottom-2 right-2 border-l-0 border-t-0'
      }`}
    />
  )

  if (loading) {
    return (
      <CardLayout>
        <div className="min-h-screen flex items-center justify-center bg-[#0a0f0a] text-white">
          <div className="w-10 h-10 border-4 border-pfa-green border-t-transparent rounded-full animate-spin" aria-label="Loading" />
        </div>
      </CardLayout>
    )
  }

  return (
    <CardLayout>
      <div className="card-page">
        <button
          onClick={signOut}
          className="absolute top-4 right-4 text-sm text-white/70 hover:text-white bg-white/5 border border-pfa-border px-3 py-1 rounded-lg"
        >
          Sign Out
        </button>

        <div className="flex flex-col items-center gap-4">
          <div style={{ position: 'relative', width: '340px', height: '520px' }}>
            {/* FRONT */}
            <div
              onClick={() => setFlipped(true)}
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '14px',
                cursor: 'pointer',
                opacity: flipped ? 0 : 1,
                pointerEvents: flipped ? 'none' : 'auto',
                transition: 'opacity 0.3s ease',
                zIndex: flipped ? 0 : 1,
                overflow: 'hidden',
                border: '3px solid transparent',
                background: 'linear-gradient(135deg, #3fae52, #ffffff, #3fae52, #0a0f0a, #3fae52)',
                backgroundOrigin: 'border-box',
              }}
            >
              <div className="absolute inset-[3px] rounded-[12px] overflow-hidden" style={{ background: '#000' }}>
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={profile?.full_name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top center', position: 'absolute', top: 0, left: 0 }}
                  />
                ) : (
                  <div className="w-full h-full" style={{ background: 'linear-gradient(160deg, #0d1a0e 0%, #0a0f0a 100%)' }} />
                )}
                <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, transparent 50%, rgba(255,255,255,0.05) 100%)', pointerEvents: 'none' }} />
                <img
                  src="https://iilysafrbbnklelzzqyh.supabase.co/storage/v1/object/public/Assets/Peak%20Athletics%20Logo%202.png"
                  alt="Peak Athletics"
                  style={{ position: 'absolute', top: '10px', left: '10px', width: '64px', height: '64px', objectFit: 'contain', zIndex: 10, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.8))' }}
                />
                <div className="absolute top-3 right-3 text-[10px] text-white/30 font-semibold">{cardNumber}</div>
                <div className="absolute" style={{ bottom: '120px', left: '-10%', width: '120%', height: '160px', background: 'rgba(63,174,82,0.08)', transform: 'rotate(-8deg)', pointerEvents: 'none', zIndex: 1 }} />
                <div className="absolute left-0 right-0" style={{ bottom: '140px', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
                  <div className="grid grid-cols-4 text-center">
                    {quickStats.map((qs, idx) => (
                      <div key={qs.id} className="py-3" style={idx < quickStats.length - 1 ? { borderRight: '1px solid rgba(63,174,82,0.3)' } : {}}>
                        <div className="text-lg font-semibold">{qs.result ? formatValue(qs.result.test_type, qs.result.value) : '—'}</div>
                        <div className="text-[10px] uppercase tracking-wide text-white/60">{qs.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
                {!avatarUrl && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ paddingBottom: '140px' }}>
                    <div className="flex items-center justify-center rounded-full" style={{ width: '120px', height: '120px', border: '2px dashed rgba(63,174,82,0.4)', color: '#3fae52', fontSize: '32px', fontWeight: '800' }}>
                      {initials}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        fileInputRef.current?.click()
                      }}
                      style={{ background: 'rgba(63,174,82,0.9)', border: 'none', borderRadius: '50%', width: '40px', height: '40px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '12px auto 0', position: 'relative', zIndex: 10 }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                        <path d="M12 15.2A3.2 3.2 0 1 1 12 8.8a3.2 3.2 0 0 1 0 6.4zm7-11.2h-1.8l-1.4-2H8.2L6.8 4H5a3 3 0 0 0-3 3v11a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3z" />
                      </svg>
                    </button>
                    <div className="mt-2 text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
                      Tap camera to add your photo
                    </div>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={onFileChange}
                  style={{ position: 'relative', zIndex: 10 }}
                />
                <div className="absolute left-0 right-0 text-white" style={{ bottom: '0', background: 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.7) 60%, rgba(0,0,0,0) 100%)', padding: '60px 16px 16px', textTransform: 'uppercase' }}>
                  <div className="text-[28px] font-extrabold tracking-[0.1em] leading-tight">{(profile?.full_name || 'Athlete').toUpperCase()}</div>
                  <div className="text-[11px]" style={{ color: '#3fae52' }}>{profile?.sport || 'Sport'}{profile?.position ? ` · ${profile.position}` : ''}</div>
                </div>
              </div>
            </div>

            {/* BACK */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '14px',
                border: '2px solid rgba(63,174,82,0.4)',
                opacity: flipped ? 1 : 0,
                pointerEvents: flipped ? 'auto' : 'none',
                transition: 'opacity 0.3s ease',
                zIndex: flipped ? 1 : 0,
                overflowY: 'scroll',
                overflowX: 'hidden',
                background: 'linear-gradient(160deg, #0d1a0e 0%, #0a0f0a 60%, #0d1008 100%)',
                padding: '16px',
                boxSizing: 'border-box',
              }}
              onClick={() => setFlipped(false)}
            >
              <div
                className="space-y-3 pr-1"
                style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '8px',
                    borderBottom: '1px solid rgba(63,174,82,0.25)',
                    paddingBottom: '8px',
                  }}
                >
                  <img
                    src="https://iilysafrbbnklelzzqyh.supabase.co/storage/v1/object/public/Assets/Peak%20Athletics%20Logo%202.png"
                    alt="PFA"
                    style={{ width: '36px', height: '36px', objectFit: 'contain' }}
                  />
                  <span
                    style={{
                      color: 'rgba(255,255,255,0.7)',
                      fontSize: '11px',
                      fontWeight: '700',
                      letterSpacing: '0.15em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {profile?.full_name}
                  </span>
                </div>

                {categories.map((cat) => {
                  const list = groupedResults[cat.key] || []
                  return (
                    <div key={cat.key} className="space-y-2">
                      <div
                        className="text-white font-bold uppercase tracking-widest text-[10px]"
                        style={{ color: '#3fae52', borderBottom: '1px solid rgba(63,174,82,0.2)', paddingBottom: '4px', marginBottom: '6px' }}
                      >
                        {cat.label}
                      </div>
                      {list.length === 0 ? (
                        <div className="text-white/60 text-xs">No data yet</div>
                      ) : (
                        list.map((r) => (
                          <div
                            key={r.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              background: 'rgba(63,174,82,0.05)',
                              border: '1px solid rgba(63,174,82,0.1)',
                              borderRadius: '8px',
                              padding: '8px 10px',
                              marginBottom: '4px',
                            }}
                          >
                            <span className="flex-1 text-white/80 capitalize">{r.test_type.replaceAll('_', ' ')}</span>
                            <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                              <div className="h-full" style={{ width: `${getBarWidth(r.test_type, convertForBar(r.test_type, r.value), r.higher_is_better !== false)}%`, background: 'linear-gradient(90deg, #3fae52, #9be58c)' }} />
                            </div>
                            <span className="text-white font-semibold text-sm">{formatValue(r.test_type, r.value)}</span>
                          </div>
                        ))
                      )}
                    </div>
                  )
                })}

                <div className="mt-auto text-xs flex items center justify-between text-white/60">
                  <span>{mostRecentDate ? `Last tested: ${mostRecentDate?.slice(0, 10)}` : 'No sessions yet'}</span>
                  <span style={{ color: '#3fae52' }}>{cardNumber}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="text-white/60 text-sm">Tap to flip</div>
          <button
            type="button"
            onClick={() => navigate('/checkin')}
            disabled={checkedInToday}
            className={`mt-2 w-full max-w-xs border rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              checkedInToday
                ? 'border-white/10 text-white/40 bg-white/5 cursor-not-allowed'
                : 'border-[#3fae52] text-[#3fae52] bg-transparent hover:bg-[#3fae52]/10'
            }`}
          >
            {checkedInToday ? 'Checked in today ✓' : 'Weekly Check-in'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/report')}
            style={{
              width: '100%',
              maxWidth: '320px',
              background: '#3fae52',
              color: '#000',
              fontWeight: '700',
              fontSize: '14px',
              padding: '12px',
              borderRadius: '24px',
              border: 'none',
              cursor: 'pointer',
              letterSpacing: '0.05em',
            }}
          >
            View Full Report
          </button>
        </div>
      </div>
    </CardLayout>
  )
}

export default Card
