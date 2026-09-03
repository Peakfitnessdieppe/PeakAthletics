import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useAuth from '../hooks/useAuth'
import CardLayout from '../components/layout/CardLayout'
import { supabase } from '../services/supabase'
import { getAthleteTestRankings, getAthleteBodyMeasurements } from '../services/reports'

const STRENGTH_LOAD_TESTS = ['squat', 'bench_press', 'trap_bar_deadlift']

const cardNumber = '#001'

const Card = () => {
  const navigate = useNavigate()
  const { user, profile, signOut } = useAuth()
  const [flipped, setFlipped] = useState(false)
  const [loading, setLoading] = useState(true)
  const [latestResults, setLatestResults] = useState([])
  const [allResults, setAllResults] = useState([])
  const [baselineResults, setBaselineResults] = useState([])
  const [testRankings, setTestRankings] = useState([])
  const [measurements, setMeasurements] = useState([])
  const [applicableTests, setApplicableTests] = useState([])
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || null)
  const [uploading, setUploading] = useState(false)
  const [photoMessage, setPhotoMessage] = useState('')
  const fileInputRef = useRef(null)
  const [compScore, setCompScore] = useState(null)

  const fetchResults = async () => {
    if (!profile?.id) return
    setLoading(true)
    try {
      const [bodyMeasurements] = await Promise.all([
        getAthleteBodyMeasurements(profile.id),
      ])
      const { data: allResultsData } = await supabase
        .from('pfa_test_results')
        .select('*, load_value, reps, relative_strength')
        .eq('athlete_id', profile.id)
        .order('date_tested', { ascending: false })
      const results = allResultsData || []
      setAllResults(results)
      setLatestResults(results)
      setBaselineResults([])
      setMeasurements(bodyMeasurements || [])
      const { data: allTestWeights } = await supabase
        .from('pfa_test_weights')
        .select('test_type, category, weight, sport, age_category, gender, is_active')
        .eq('is_active', true)

      const sport = profile.sport
      const ageCategory = profile.age_category
      const gender = profile.gender

      const sportWeights = (allTestWeights || []).filter((w) => w.sport === sport || w.sport === 'default')
      const applicable = (() => {
        let match = sportWeights.filter((w) => w.sport === sport && w.age_category === ageCategory && w.gender === gender)
        if (!match.length) match = sportWeights.filter((w) => w.sport === sport && w.age_category === ageCategory && w.gender === 'all')
        if (!match.length) match = sportWeights.filter((w) => w.sport === sport && w.age_category === 'all' && w.gender === 'all')
        if (!match.length) match = sportWeights.filter((w) => w.sport === 'default')
        return match.map((w) => w.test_type)
      })()
      setApplicableTests(applicable)
      console.log('[Card] profile:', profile)
      console.log('[Card] latest results:', results)
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
    const ROUND_TO_INT = ['squat', 'trap_bar_deadlift', 'bench_press']
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
      imtp: 'N/kg',
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
    return d.getMonth() >= 9 ? d.getFullYear() + 1 : d.getFullYear()
  }

  const buildSeasonStats = (results, testList) => {
    const LOWER_IS_BETTER = ['10m_sprint', '30m_sprint', 'pro_agility_shuttle']
    const ALL_TESTS = testList || []
    const TEST_LABELS = {
      '10m_sprint': '10m Sprint',
      '30m_sprint': '30m Sprint',
      vertical_jump: 'Vertical Jump',
      broad_jump: 'Broad Jump',
      ncmj: 'NCMJ',
      mb_chest_pass: 'MB Chest Pass',
      pro_agility_shuttle: 'Pro Agility',
      beep_test: 'Beep Test',
      squat: 'Squat*',
      trap_bar_deadlift: 'Trap Bar Deadlift*',
      bench_press: 'Bench Press*',
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
      imtp: 'N/kg',
    }
    const ROUND_TO_INT = ['squat', 'trap_bar_deadlift', 'bench_press']

    const byTestBySeason = {}
    for (const r of results || []) {
      const season = getSeasonYear(r.date_tested)
      if (!byTestBySeason[r.test_type]) byTestBySeason[r.test_type] = {}
      const current = byTestBySeason[r.test_type][season]
      if (!current) {
        byTestBySeason[r.test_type][season] = r
      } else {
        const isBetter = LOWER_IS_BETTER.includes(r.test_type)
          ? r.value < current.value
          : r.value > current.value
        if (isBetter) byTestBySeason[r.test_type][season] = r
      }
    }

    const formatVal = (testType, rec) => {
      if (!rec || rec.value === undefined || rec.value === null) return { main: '—', load: null, reps: null }
      const v = testType === 'imtp'
        ? parseFloat(rec.value).toFixed(2)
        : ROUND_TO_INT.includes(testType)
        ? Math.round(rec.value)
        : rec.value
      return {
        main: `${v} ${TEST_UNITS[testType] || ''}`.trim(),
        load: rec.load_value,
        reps: rec.reps,
      }
    }

    return ALL_TESTS.map((testType) => {
      const f2025 = formatVal(testType, byTestBySeason[testType]?.[2025])
      const f2026 = formatVal(testType, byTestBySeason[testType]?.[2026])
      return {
        testType,
        label: TEST_LABELS[testType],
        unit: TEST_UNITS[testType],
        season2025: f2025.main,
        season2026: f2026.main,
        load2025: f2025.load,
        reps2025: f2025.reps,
        load2026: f2026.load,
        reps2026: f2026.reps,
        hasAnyData: !!(byTestBySeason[testType]?.[2025] || byTestBySeason[testType]?.[2026]),
        notTested2026: !byTestBySeason[testType]?.[2026] && !!byTestBySeason[testType]?.[2025],
      }
    })
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
      return d.getMonth() >= 9 ? d.getFullYear() + 1 : d.getFullYear()
    }

    const bySeasonField = { 2025: {}, 2026: {} }

    const sortedDesc = [...(measurements || [])].sort(
      (a, b) => new Date(b.measurement_date) - new Date(a.measurement_date)
    )

    for (const m of sortedDesc) {
      const season = getSeasonYear(m.measurement_date)
      if (season !== 2025 && season !== 2026) continue
      const s = bySeasonField[season]
      if (m.height != null && s.height == null) s.height = m.height
      if (m.weight != null && s.weight == null) s.weight = m.weight
      if (m.body_fat_percentage != null && s.body_fat_percentage == null) s.body_fat_percentage = m.body_fat_percentage
    }

    const fmt = (val, suffix) => (val != null ? `${val}${suffix}` : '—')
    const s25 = bySeasonField[2025]
    const s26 = bySeasonField[2026]

    return [
      {
        label: 'Height',
        season2025: s25.height != null ? inchesToFtIn(s25.height) : '—',
        season2026: s26.height != null ? inchesToFtIn(s26.height) : '—',
      },
      {
        label: 'Weight',
        season2025: s25.weight != null ? fmt(s25.weight, ' lbs') : '—',
        season2026: s26.weight != null ? fmt(s26.weight, ' lbs') : '—',
      },
      {
        label: 'Body Fat',
        season2025: s25.body_fat_percentage != null ? fmt(s25.body_fat_percentage, '%') : '—',
        season2026: s26.body_fat_percentage != null ? fmt(s26.body_fat_percentage, '%') : '—',
      },
    ]
  }

  const profileId = profile?.id || ''
  const profileAgeCat = profile?.age_category || ''
  const profileGender = profile?.gender || ''
  const profileAvatarUrl = profile?.avatar_url || ''

  useEffect(() => {
    fetchResults()
  }, [profileId])

  useEffect(() => {
    const fetchComposite = async () => {
      if (!profileId) return
      try {
        const { data: compScores, error } = await supabase
          .from('pfa_composite_scores')
          .select('*')
          .eq('athlete_id', profileId)
          .in('season', [2025, 2026])
        console.log('[Card] compScore fetch result:', compScores, error)
        setCompScore(compScores || [])
      } catch (err) {
        console.error('Failed to load composite scores', err)
      }
    }
    fetchComposite()
  }, [profileId])

  useEffect(() => {
    const loadRankings = async () => {
      if (!profileId || !profileAgeCat || !profileGender) return
      const rankings = await getAthleteTestRankings(profileId, profileAgeCat, profileGender)
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
  }, [profileId, profileAgeCat, profileGender])

  useEffect(() => {
    setAvatarUrl(profileAvatarUrl || null)
  }, [profileAvatarUrl])

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
      // Remove previous photo if present
      const { data: existingProfile, error: fetchError } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', profile.id)
        .single()
      if (fetchError && fetchError.code !== 'PGRST116') throw fetchError
      const currentUrl = existingProfile?.avatar_url
      if (currentUrl) {
        const oldPath = (() => {
          try {
            const url = new URL(currentUrl)
            const segments = url.pathname.split('/')
            const bucketIndex = segments.findIndex((p) => decodeURIComponent(p) === 'Athlete Photos')
            if (bucketIndex >= 0) return decodeURIComponent(segments.slice(bucketIndex + 1).join('/'))
          } catch (err) {
            console.error('Parse old avatar URL failed', err)
          }
          const extGuess = currentUrl.split('.').pop()
          return `${profile.id}/avatar.${extGuess}`
        })()
        if (oldPath) {
          const { error: removeError } = await supabase.storage.from('Athlete Photos').remove([oldPath])
          if (removeError) console.error('Remove old photo failed', removeError)
        }
      }

      // Upload new with unique path
      const ext = file.name.split('.').pop()
      const path = `${profile.id}_${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('Athlete Photos')
        .upload(path, file, { upsert: true })
      if (uploadError) throw uploadError
      const { data: urlData } = supabase.storage.from('Athlete Photos').getPublicUrl(path)
      const newUrl = `${urlData.publicUrl}?t=${Date.now()}`
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ avatar_url: urlData.publicUrl, updated_at: new Date().toISOString() })
        .eq('id', profile.id)
      if (profileError) throw profileError
      setAvatarUrl(newUrl)
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
      const bucketIndex = segments.findIndex((p) => decodeURIComponent(p) === 'Athlete Photos')
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
        const { error: removeError } = await supabase.storage.from('Athlete Photos').remove([path])
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
      <div
        className="card-page"
        style={{
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}
      >
        <button
          onClick={signOut}
          className="absolute top-4 right-4 text-sm text-white/70 hover:text-white bg-white/5 border border-pfa-border px-3 py-1 rounded-lg hidden sm:block"
        >
          Sign Out
        </button>

        <div className="flex flex-col items-center gap-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onFileChange}
          />
          <div
            style={{
              position: 'relative',
              width: 'min(340px, 92vw)',
              height: 'min(520px, 85vh)',
            }}
          >
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
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 'clamp(9px, 2.4vw, 12px)', textAlign: 'center', padding: '16px' }}>
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
                            <div className="text-[8px] uppercase tracking-wide text-white/60 font-bold" style={{ marginBottom: '2px', textAlign: 'center', fontSize: 'clamp(8px, 1.8vw, 10px)' }}>
                              {formatted.label}
                            </div>
                            <div className="text-[15px] font-semibold" style={{ textAlign: 'center', color: '#fff', fontSize: 'clamp(12px, 3.4vw, 15px)' }}>
                              {formatted.value}
                              <span style={{ fontSize: 'clamp(8px, 2vw, 10px)', color: 'rgba(255,255,255,0.6)', marginLeft: '2px' }}>{formatted.unit}</span>
                            </div>
                            <div
                              style={{
                                color: '#fff',
                                fontWeight: 700,
                                fontSize: 'clamp(11px, 3vw, 14px)',
                                opacity: ranking.hasAnyData ? 1 : 0.35,
                              }}
                            >
                              {ranking.season2025?.main || ranking.season2025}
                              {['squat', 'bench_press', 'trap_bar_deadlift'].includes(ranking.testType) && ranking.season2025?.load && ranking.season2025?.reps && (
                                <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 'clamp(6px, 1.6vw, 8px)', marginTop: '2px' }}>
                                  {ranking.season2025.load} × {ranking.season2025.reps}
                                </div>
                              )}
                            </div>
                            {badge && (
                              <div
                                style={{
                                  marginTop: '3px',
                                  fontSize: 'clamp(7px, 1.8vw, 9px)',
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
                        e.preventDefault()
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
                <div className="absolute left-0 right-0 text-white" style={{ bottom: '0', background: 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.7) 60%, rgba(0,0,0,0) 100%)', padding: '60px 16px 16px', textTransform: 'uppercase' }}>
                  <div className="text-[28px] font-extrabold tracking-[0.1em] leading-tight" style={{ fontSize: 'clamp(14px, 4vw, 20px)' }}>{(profile?.full_name || 'Athlete').toUpperCase()}</div>
                  <div className="text-[11px]" style={{ color: '#3fae52', fontSize: 'clamp(9px, 2.4vw, 12px)' }}>{profile?.sport || 'Sport'}{profile?.position ? ` · ${profile.position}` : ''}</div>
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
                  const resultTestTypes = Array.from(new Set(allResults.map(r => r.test_type)))
                  const backTestTypes = Array.from(new Set([...applicableTests, ...resultTestTypes]))
                  const seasonStats = buildSeasonStats(allResults, backTestTypes)
                  const measurementRows = buildMeasurementSeasons(measurements)
                  return (
                    <>
                      <div style={{ padding: 'clamp(8px, 2vw, 12px) clamp(10px, 3vw, 16px) 0' }}>
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr min(80px, 20vw) min(80px, 20vw)',
                            padding: '6px 0',
                            borderBottom: '1px solid rgba(63,174,82,0.3)',
                            marginBottom: '4px',
                          }}
                        >
                          <div style={{ color: 'rgba(63,174,82,0.6)', fontSize: 'clamp(8px, 1.8vw, 10px)', fontWeight: '700', letterSpacing: '0.1em', textTransform: 'uppercase' }}>MEASUREMENTS</div>
                          <div style={{ color: 'rgba(63,174,82,0.6)', fontSize: 'clamp(8px, 1.8vw, 10px)', fontWeight: '700', letterSpacing: '0.1em', textAlign: 'center' }}>2025</div>
                          <div style={{ color: '#3fae52', fontSize: 'clamp(8px, 1.8vw, 10px)', fontWeight: '700', letterSpacing: '0.1em', textAlign: 'center' }}>2026</div>
                        </div>
                        {measurementRows.map((row, i) => (
                          <div
                            key={row.label}
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '1fr min(80px, 20vw) min(80px, 20vw)',
                              padding: '5px 0',
                              borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                            }}
                          >
                            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 'clamp(9px, 2vw, 11px)', fontWeight: '600' }}>{row.label}</div>
                            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 'clamp(9px, 2vw, 11px)', textAlign: 'center' }}>{row.season2025}</div>
                            <div
                              style={{
                                color: row.season2026 !== '—' ? '#ffffff' : 'rgba(255,255,255,0.25)',
                                fontSize: 'clamp(9px, 2vw, 11px)',
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

                      <div style={{ padding: '0 clamp(10px, 3vw, 16px) clamp(8px, 2vw, 16px)' }}>
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr min(80px, 20vw) min(80px, 20vw)',
                            padding: '6px 0',
                            borderBottom: '1px solid rgba(63,174,82,0.3)',
                            marginBottom: '4px',
                          }}
                        >
                          <div style={{ color: 'rgba(63,174,82,0.6)', fontSize: 'clamp(8px, 1.8vw, 10px)', fontWeight: '700', letterSpacing: '0.1em', textTransform: 'uppercase' }}>TEST</div>
                          <div style={{ color: 'rgba(63,174,82,0.6)', fontSize: 'clamp(8px, 1.8vw, 10px)', fontWeight: '700', letterSpacing: '0.1em', textAlign: 'center' }}>2025</div>
                          <div style={{ color: '#3fae52', fontSize: 'clamp(8px, 1.8vw, 10px)', fontWeight: '700', letterSpacing: '0.1em', textAlign: 'center' }}>2026</div>
                        </div>

                        {seasonStats.map((stat, i) => (
                          <div
                            key={stat.testType}
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '1fr min(80px, 20vw) min(80px, 20vw)',
                              padding: '5px 0',
                              borderBottom: i < seasonStats.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                              opacity: stat.hasAnyData ? 1 : 0.35,
                            }}
                          >
                            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 'clamp(9px, 2vw, 11px)', fontWeight: '600' }}>
                              {stat.label}
                              {stat.notTested2026 && (
                                <span style={{ color: 'rgba(255,255,255,0.35)', marginLeft: '2px' }}>*</span>
                              )}
                            </div>
                            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 'clamp(9px, 2vw, 11px)', textAlign: 'center' }}>
                              <div>{stat.season2025}</div>
                              {STRENGTH_LOAD_TESTS.includes(stat.testType) && stat.load2025 && stat.reps2025 && (
                                <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 'clamp(6px, 1.6vw, 8px)', marginTop: '1px' }}>
                                  {stat.load2025} × {stat.reps2025}
                                </div>
                              )}
                            </div>
                            <div
                              style={{
                                color: stat.season2026 && stat.season2026 !== '—' ? '#ffffff' : 'rgba(255,255,255,0.25)',
                                fontSize: 'clamp(9px, 2vw, 11px)',
                                fontWeight: stat.season2026 && stat.season2026 !== '—' ? '700' : '400',
                                textAlign: 'center',
                              }}
                            >
                              <div>
                                {stat.notTested2026 ? (
                                  <span style={{ color: 'rgba(255,255,255,0.3)' }}>N/A</span>
                                ) : (
                                  stat.season2026
                                )}
                              </div>
                              {STRENGTH_LOAD_TESTS.includes(stat.testType) && stat.load2026 && stat.reps2026 && (
                                <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 'clamp(6px, 1.6vw, 8px)', marginTop: '1px' }}>
                                  {stat.load2026} × {stat.reps2026}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                        <div
                          style={{
                            marginTop: '8px',
                            paddingTop: '8px',
                            borderTop: '1px solid rgba(255,255,255,0.06)',
                            color: 'rgba(255,255,255,0.3)',
                            fontSize: '8px',
                            lineHeight: '1.4',
                            fontStyle: 'italic',
                          }}
                        >
                          * Squat, Bench Press, and Trap Bar Deadlift values represent an estimated one-repetition maximum (1RM), calculated from the load and repetitions completed during testing using a validated predictive formula.
                        </div>
                        {seasonStats.some(stat => stat.notTested2026) && (
                          <p style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', fontStyle: 'italic', marginTop: '6px', lineHeight: '1.4' }}>
                            * Not re-tested in the current training cycle (2026)
                          </p>
                        )}
                      </div>

                      {/* STANDARDIZED SCORES */}
                      <div style={{ padding: '12px 16px 0' }}>
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr min(80px, 20vw) min(80px, 20vw)',
                            padding: '6px 0',
                            borderBottom: '1px solid rgba(63,174,82,0.3)',
                            marginBottom: '4px',
                          }}
                        >
                          <div style={{ color: 'rgba(63,174,82,0.6)', fontSize: 'clamp(8px, 1.8vw, 10px)', fontWeight: '700', letterSpacing: '0.1em', textTransform: 'uppercase' }}>STANDARDIZED SCORES</div>
                          <div style={{ color: 'rgba(63,174,82,0.6)', fontSize: 'clamp(8px, 1.8vw, 10px)', fontWeight: '700', letterSpacing: '0.1em', textAlign: 'center' }}>2025</div>
                          <div style={{ color: '#3fae52', fontSize: 'clamp(8px, 1.8vw, 10px)', fontWeight: '700', letterSpacing: '0.1em', textAlign: 'center' }}>2026</div>
                        </div>

                        {[
                          { label: 'Overall', key: 'overall_score' },
                          { label: 'Speed', key: 'speed_score' },
                          { label: 'Power', key: 'power_score' },
                          { label: 'Strength', key: 'strength_score' },
                          { label: 'Agility', key: 'agility_score' },
                          { label: 'Endurance', key: 'endurance_score' },
                        ].map((row, i, arr) => {
                          const latestTestDate = (latestResults || []).reduce((latest, r) => {
                            return !latest || r.date_tested > latest ? r.date_tested : latest
                          }, null)
                          const scoreSeasonYear = latestTestDate ? getSeasonYear(latestTestDate) : null
                          console.log('[Card] latestResults:', latestResults?.length, latestResults?.[0])
                          console.log('[Card] latestTestDate:', latestTestDate)
                          console.log('[Card] scoreSeasonYear:', scoreSeasonYear)
                          console.log('[Card] compScore:', compScore)
                          const score2025Row = compScore?.find(s => s.season === 2025)
                          const score2026Row = compScore?.find(s => s.season === 2026)
                          const score2025 =
                            score2025Row && score2025Row[row.key] != null
                              ? Math.round(score2025Row[row.key])
                              : null
                          const score2026 =
                            score2026Row && score2026Row[row.key] != null
                              ? Math.round(score2026Row[row.key])
                              : null

                          return (
                            <div
                              key={row.key}
                              style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr min(80px, 20vw) min(80px, 20vw)',
                                padding: '5px 0',
                                borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                              }}
                            >
                              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 'clamp(9px, 2vw, 11px)', fontWeight: '600' }}>{row.label}</div>
                              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 'clamp(9px, 2vw, 11px)', textAlign: 'center' }}>
                                {score2025 !== null ? score2025 : '—'}
                              </div>
                              <div
                                style={{
                                  color: score2026 !== null ? '#ffffff' : 'rgba(255,255,255,0.25)',
                                  fontSize: 'clamp(9px, 2vw, 11px)',
                                  fontWeight: score2026 !== null ? '700' : '400',
                                  textAlign: 'center',
                                }}
                              >
                                {score2026 !== null ? score2026 : '—'}
                              </div>
                            </div>
                          )
                        })}
                        <div style={{ borderBottom: '1px solid rgba(63,174,82,0.2)', margin: '8px 0' }} />
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
          {avatarUrl ? (
            <div
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', marginTop: '12px' }}
              className="text-white/60 text-sm"
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
              <span>Tap to flip</span>
              <button
                type="button"
                onClick={removePhoto}
                style={{ fontSize: '10px', padding: '4px 10px', background: 'rgba(255,64,64,0.85)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
              >
                Remove Photo
              </button>
              {photoMessage && <span style={{ fontSize: '10px', color: '#3fae52' }}>{photoMessage}</span>}
            </div>
          ) : (
            <div className="text-white/60 text-sm">Tap to flip</div>
          )}

          {profile?.role !== 'athlete' && (
            <div
              onClick={() => navigate('/pro')}
              className="mx-4 mb-4 cursor-pointer group rounded-xl border border-[#3fae52]/30 bg-[#0d1a0d] hover:border-[#3fae52]/70 hover:bg-[#0d1a0d] transition-all overflow-hidden"
            >
              <div className="flex items-center justify-between px-5 py-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold uppercase tracking-widest text-[#3fae52]">PFA PRO</span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#3fae52]/20 text-[#3fae52] uppercase tracking-wide">BETA</span>
                  </div>
                  <div className="text-white font-bold text-sm">Access Your Training Programs</div>
                  <div className="text-gray-500 text-xs mt-0.5">8-week dryland programs from the PFA coaching team</div>
                </div>
                <div className="text-[#3fae52] text-xl group-hover:translate-x-1 transition-transform">→</div>
              </div>
            </div>
          )}

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
          <button
            type="button"
            onClick={signOut}
            className="sm:hidden"
            style={{
              width: '100%',
              maxWidth: '320px',
              marginTop: '10px',
              background: 'rgba(255,255,255,0.08)',
              color: 'white',
              fontWeight: '700',
              fontSize: '13px',
              padding: '12px',
              borderRadius: '16px',
              border: '1px solid rgba(255,255,255,0.15)',
              cursor: 'pointer',
              letterSpacing: '0.05em',
            }}
          >
            Sign Out
          </button>
        </div>
      </div>
    </CardLayout>
  )
}

export default Card
