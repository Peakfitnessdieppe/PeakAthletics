import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useAuth from '../hooks/useAuth'
import CardLayout from '../components/layout/CardLayout'
import { supabase } from '../services/supabase'
import { getLatestResults, getBaselineResults } from '../services/testResults'
import { getAthleteTestRankings, getAthleteBodyMeasurements } from '../services/reports'

const cardNumber = '#001'

const Card = () => {
  const navigate = useNavigate()
  const { user, profile, signOut } = useAuth()
  const [flipped, setFlipped] = useState(false)
  const [loading, setLoading] = useState(true)
  const [latestResults, setLatestResults] = useState([])
  const [baselineResults, setBaselineResults] = useState([])
  const [testRankings, setTestRankings] = useState([])
  const [measurements, setMeasurements] = useState([])
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || null)
  const [uploading, setUploading] = useState(false)
  const [photoMessage, setPhotoMessage] = useState('')
  const fileInputRef = useRef(null)
  const [checkedInToday, setCheckedInToday] = useState(false)

  const todayStr = () => new Date().toISOString().split('T')[0]

  const fetchResults = async () => {
    if (!profile?.id) return
    setLoading(true)
    try {
      const [latest, baseline, bodyMeasurements] = await Promise.all([
        getLatestResults(profile.id),
        getBaselineResults(profile.id),
        getAthleteBodyMeasurements(profile.id),
      ])
      setLatestResults(latest || [])
      setBaselineResults(baseline || [])
      setMeasurements(bodyMeasurements || [])
      console.log('[Card] profile:', profile)
      console.log('[Card] latest results:', latest)
    } catch (err) {
      console.error('Failed to load results', err)
    }
    setLoading(false)
  }

  const getBadge = (ranking) => {
    if (ranking.isAllTimeRecord) return { label: 'ALL-TIME RECORD', color: '#FFD700' }
    if (ranking.isAgeGroupRecord) return { label: `${ranking.ageCategory} RECORD`, color: '#FFD700' }
    if (!ranking.rank || ranking.cohortSize < 5) return null
    if (ranking.rank === 1) return { label: 'RANKED #1', color: '#FFD700' }
    if (ranking.rank <= 3) return { label: 'TOP 3', color: '#C0C0C0' }
    if (ranking.rank <= 10) return { label: 'TOP 10', color: '#CD7F32' }
    return null
  }

  const formatCardValue = (testType, value) => {
    const ROUND_TO_INT = ['squat', 'trap_bar_deadlift', 'bench_press', 'imtp']
    const units = {
      '10m_sprint': 's',
      '30m_sprint': 's',
      'pro_agility_shuttle': 's',
      vertical_jump: 'cm',
      broad_jump: 'm',
      ncmj: 'cm',
      mb_chest_pass: 'm',
      beep_test: 'lvl',
      squat: 'lbs',
      trap_bar_deadlift: 'lbs',
      bench_press: 'lbs',
      pull_ups: 'reps',
      push_ups: 'reps',
      imtp: 'lbs',
    }
    const labels = {
      '10m_sprint': '10M SPRINT',
      '30m_sprint': '30M SPRINT',
      pro_agility_shuttle: 'PRO AGILITY',
      vertical_jump: 'VERTICAL',
      broad_jump: 'BROAD JUMP',
      ncmj: 'NCMJ',
      mb_chest_pass: 'MB PASS',
      beep_test: 'BEEP TEST',
      squat: 'SQUAT',
      trap_bar_deadlift: 'TRAP BAR',
      bench_press: 'BENCH',
      pull_ups: 'PULL-UPS',
      push_ups: 'PUSH-UPS',
      imtp: 'IMTP',
    }
    const displayValue = ROUND_TO_INT.includes(testType) ? Math.round(value) : value
    return {
      label: labels[testType] || testType.toUpperCase().replace(/_/g, ' '),
      value: displayValue,
      unit: units[testType] || '',
    }
  }

  const getSeasonYear = (dateStr) => {
    const d = new Date(dateStr)
    return d.getMonth() >= 8 ? d.getFullYear() + 1 : d.getFullYear()
  }

  const buildSeasonStats = (results) => {
    const LOWER_IS_BETTER = ['10m_sprint', '30m_sprint', 'pro_agility_shuttle']
    const ALL_TESTS = [
      '10m_sprint',
      '30m_sprint',
      'vertical_jump',
      'broad_jump',
      'ncmj',
      'mb_chest_pass',
      'pro_agility_shuttle',
      'beep_test',
      'squat',
      'trap_bar_deadlift',
      'bench_press',
      'pull_ups',
      'push_ups',
      'imtp',
    ]
    const TEST_LABELS = {
      '10m_sprint': '10m Sprint',
      '30m_sprint': '30m Sprint',
      vertical_jump: 'Vertical Jump',
      broad_jump: 'Broad Jump',
      ncmj: 'NCMJ',
      mb_chest_pass: 'MB Chest Pass',
      pro_agility_shuttle: 'Pro Agility',
      beep_test: 'Beep Test',
      squat: 'Squat',
      trap_bar_deadlift: 'Trap Bar Deadlift',
      bench_press: 'Bench Press',
      pull_ups: 'Pull-Ups',
      push_ups: 'Push-Ups',
      imtp: 'IMTP',
    }
    const TEST_UNITS = {
      '10m_sprint': 's',
      '30m_sprint': 's',
      pro_agility_shuttle: 's',
      vertical_jump: 'cm',
      broad_jump: 'm',
      ncmj: 'cm',
      mb_chest_pass: 'm',
      beep_test: 'lvl',
      squat: 'lbs',
      trap_bar_deadlift: 'lbs',
      bench_press: 'lbs',
      pull_ups: 'reps',
      push_ups: 'reps',
      imtp: 'lbs',
    }
    const ROUND_TO_INT = ['squat', 'trap_bar_deadlift', 'bench_press', 'imtp']

    const byTestBySeason = {}
    for (const r of results || []) {
      const season = getSeasonYear(r.date_tested)
      if (!byTestBySeason[r.test_type]) byTestBySeason[r.test_type] = {}
      const current = byTestBySeason[r.test_type][season]
      if (!current) {
        byTestBySeason[r.test_type][season] = r.value
      } else {
        const isBetter = LOWER_IS_BETTER.includes(r.test_type)
          ? r.value < current
          : r.value > current
        if (isBetter) byTestBySeason[r.test_type][season] = r.value
      }
    }

    const formatVal = (testType, val) => {
      if (val === undefined || val === null) return '—'
      const v = ROUND_TO_INT.includes(testType) ? Math.round(val) : val
      return `${v} ${TEST_UNITS[testType] || ''}`.trim()
    }

    return ALL_TESTS.map((testType) => ({
      testType,
      label: TEST_LABELS[testType],
      unit: TEST_UNITS[testType],
      season2025: formatVal(testType, byTestBySeason[testType]?.[2025]),
      season2026: formatVal(testType, byTestBySeason[testType]?.[2026]),
      hasAnyData: !!(byTestBySeason[testType]?.[2025] || byTestBySeason[testType]?.[2026]),
    }))
  }

  const inchesToFtIn = (inches) => {
    if (!inches) return '—'
    const ft = Math.floor(inches / 12)
    const ins = Math.round(inches % 12)
    return `${ft}'${ins}"`
  }

  const buildMeasurementSeasons = (measurements) => {
    const getSeasonYear = (dateStr) => {
      const d = new Date(dateStr)
      return d.getMonth() >= 8 ? d.getFullYear() + 1 : d.getFullYear()
    }

    const bySeason = {}
    for (const m of measurements) {
      const season = getSeasonYear(m.measurement_date)
      if (!bySeason[season]) bySeason[season] = m
    }

    const fmt = (val, suffix) => (val != null ? `${val}${suffix}` : '—')

    return [
      {
        label: 'Height',
        season2025: bySeason[2025] ? inchesToFtIn(bySeason[2025].height) : '—',
        season2026: bySeason[2026] ? inchesToFtIn(bySeason[2026].height) : '—',
      },
      {
        label: 'Weight',
        season2025: bySeason[2025] ? fmt(bySeason[2025].weight, ' lbs') : '—',
        season2026: bySeason[2026] ? fmt(bySeason[2026].weight, ' lbs') : '—',
      },
      {
        label: 'Body Fat',
        season2025: bySeason[2025] ? fmt(bySeason[2025].body_fat_percentage, '%') : '—',
        season2026: bySeason[2026] ? fmt(bySeason[2026].body_fat_percentage, '%') : '—',
      },
    ]
  }

  useEffect(() => {
    fetchResults()
  }, [profile?.id])

  useEffect(() => {
    const loadRankings = async () => {
      if (!profile?.id || !profile?.age_category || !profile?.gender) return
      const rankings = await getAthleteTestRankings(profile.id, profile.age_category, profile.gender)
      console.log(
        'Test rankings loaded:',
        JSON.stringify(
          rankings.map((r) => ({
            test: r.testType,
            rank: r.rank,
            cohortSize: r.cohortSize,
            isAllTimeRecord: r.isAllTimeRecord,
          })),
          null,
          2
        )
      )
      setTestRankings(rankings)
    }
    loadRankings()
  }, [profile?.id, profile?.age_category, profile?.gender])

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

  const getAvatarPath = () => {
    if (!avatarUrl || !profile?.id) return null
    try {
      const url = new URL(avatarUrl)
      const segments = url.pathname.split('/')
      const bucketIndex = segments.findIndex((p) => decodeURIComponent(p) === 'Athlete Photos' || decodeURIComponent(p) === 'athlete-photos')
      if (bucketIndex >= 0) {
        return decodeURIComponent(segments.slice(bucketIndex + 1).join('/'))
      }
    } catch (err) {
      console.error('Failed to parse avatar URL', err)
    }
    const ext = avatarUrl.split('.').pop()
    return `${profile.id}/avatar.${ext}`
  }

  const removePhoto = async (e) => {
    if (e) e.stopPropagation()
    if (!avatarUrl || !profile?.id) return
    setUploading(true)
    try {
      const path = getAvatarPath()
      if (path) {
        const { error: removeError } = await supabase.storage.from('athlete-photos').remove([path])
        if (removeError) throw removeError
      }
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ avatar_url: null, updated_at: new Date().toISOString() })
        .eq('id', profile.id)
      if (profileError) throw profileError
      setAvatarUrl(null)
      setPhotoMessage('Photo removed')
      setTimeout(() => setPhotoMessage(''), 2000)
    } catch (err) {
      console.error('Remove photo failed', err)
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
                  {testRankings.slice(0, 4).length === 0 ? (
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', textAlign: 'center', padding: '16px' }}>
                      Complete your first test to unlock your stats.
                    </div>
                  ) : (
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: `repeat(${testRankings.slice(0, 4).length}, 1fr)`,
                        gap: '0',
                        padding: '8px 12px',
                        width: '100%',
                        overflow: 'hidden',
                        boxSizing: 'border-box',
                      }}
                    >
                      {testRankings.slice(0, 4).map((ranking, idx, arr) => {
                        const badge = getBadge(ranking)
                        const formatted = formatCardValue(ranking.testType, ranking.value)
                        return (
                          <div
                            key={ranking.testType}
                            className="py-2"
                            style={idx < arr.length - 1 ? { borderRight: '1px solid rgba(63,174,82,0.3)' } : { textAlign: 'center' }}
                          >
                            <div className="text-[8px] uppercase tracking-wide text-white/60 font-bold" style={{ marginBottom: '2px', textAlign: 'center' }}>
                              {formatted.label}
                            </div>
                            <div className="text-[15px] font-semibold" style={{ textAlign: 'center', color: '#fff' }}>
                              {formatted.value}
                              <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)', marginLeft: '2px' }}>{formatted.unit}</span>
                            </div>
                            {badge && (
                              <div
                                style={{
                                  marginTop: '3px',
                                  fontSize: '8px',
                                  fontWeight: '800',
                                  letterSpacing: '0.1em',
                                  textTransform: 'uppercase',
                                  color: badge.color,
                                  lineHeight: 1,
                                  textAlign: 'center',
                                }}
                              >
                                {badge.label}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
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
                {avatarUrl && (
                  <div
                    className="absolute flex items-center gap-2"
                    style={{ bottom: '108px', left: '12px', zIndex: 12 }}
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        fileInputRef.current?.click()
                      }}
                      style={{ fontSize: '10px', padding: '4px 10px', background: 'rgba(63,174,82,0.85)', color: '#000', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
                    >
                      Change Photo
                    </button>
                    <button
                      type="button"
                      onClick={removePhoto}
                      style={{ fontSize: '10px', padding: '4px 10px', background: 'rgba(255,64,64,0.85)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
                    >
                      Remove Photo
                    </button>
                    {photoMessage && (
                      <span style={{ fontSize: '10px', color: '#3fae52' }}>{photoMessage}</span>
                    )}
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
              className="card-back-scroll"
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '14px',
                border: '2px solid rgba(63,174,82,0.4)',
                opacity: flipped ? 1 : 0,
                pointerEvents: flipped ? 'auto' : 'none',
                transition: 'opacity 0.3s ease',
                zIndex: flipped ? 1 : 0,
                overflowY: 'auto',
                overflowX: 'hidden',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
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

                {(() => {
                  const seasonStats = buildSeasonStats(latestResults)
                  const measurementRows = buildMeasurementSeasons(measurements)
                  return (
                    <>
                      <div style={{ padding: '12px 16px 0' }}>
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 80px 80px',
                            padding: '6px 0',
                            borderBottom: '1px solid rgba(63,174,82,0.3)',
                            marginBottom: '4px',
                          }}
                        >
                          <div style={{ color: 'rgba(63,174,82,0.6)', fontSize: '9px', fontWeight: '700', letterSpacing: '0.1em', textTransform: 'uppercase' }}>MEASUREMENTS</div>
                          <div style={{ color: 'rgba(63,174,82,0.6)', fontSize: '9px', fontWeight: '700', letterSpacing: '0.1em', textAlign: 'center' }}>2025</div>
                          <div style={{ color: '#3fae52', fontSize: '9px', fontWeight: '700', letterSpacing: '0.1em', textAlign: 'center' }}>2026</div>
                        </div>
                        {measurementRows.map((row, i) => (
                          <div
                            key={row.label}
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '1fr 80px 80px',
                              padding: '5px 0',
                              borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                            }}
                          >
                            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '10px', fontWeight: '600' }}>{row.label}</div>
                            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px', textAlign: 'center' }}>{row.season2025}</div>
                            <div
                              style={{
                                color: row.season2026 !== '—' ? '#ffffff' : 'rgba(255,255,255,0.25)',
                                fontSize: '10px',
                                fontWeight: row.season2026 !== '—' ? '700' : '400',
                                textAlign: 'center',
                              }}
                            >
                              {row.season2026}
                            </div>
                          </div>
                        ))}
                        <div style={{ borderBottom: '1px solid rgba(63,174,82,0.2)', margin: '8px 0' }} />
                      </div>

                      <div style={{ padding: '0 16px 16px' }}>
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 80px 80px',
                            padding: '6px 0',
                            borderBottom: '1px solid rgba(63,174,82,0.3)',
                            marginBottom: '4px',
                          }}
                        >
                          <div style={{ color: 'rgba(63,174,82,0.6)', fontSize: '9px', fontWeight: '700', letterSpacing: '0.1em', textTransform: 'uppercase' }}>TEST</div>
                          <div style={{ color: 'rgba(63,174,82,0.6)', fontSize: '9px', fontWeight: '700', letterSpacing: '0.1em', textAlign: 'center' }}>2025</div>
                          <div style={{ color: '#3fae52', fontSize: '9px', fontWeight: '700', letterSpacing: '0.1em', textAlign: 'center' }}>2026</div>
                        </div>

                        {seasonStats.map((stat, i) => (
                          <div
                            key={stat.testType}
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '1fr 80px 80px',
                              padding: '5px 0',
                              borderBottom: i < seasonStats.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                              opacity: stat.hasAnyData ? 1 : 0.35,
                            }}
                          >
                            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '10px', fontWeight: '600' }}>{stat.label}</div>
                            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px', textAlign: 'center' }}>{stat.season2025}</div>
                            <div
                              style={{
                                color: stat.season2026 !== '—' ? '#ffffff' : 'rgba(255,255,255,0.25)',
                                fontSize: '10px',
                                fontWeight: stat.season2026 !== '—' ? '700' : '400',
                                textAlign: 'center',
                              }}
                            >
                              {stat.season2026}
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )
                })()}

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
