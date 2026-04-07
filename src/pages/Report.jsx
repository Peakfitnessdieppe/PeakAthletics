import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Chart,
  RadarController,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
  LineController,
  CategoryScale,
  LinearScale,
} from 'chart.js'
import useAuth from '../hooks/useAuth'
import { getAthleteReport, getPfaAverageScores, getTeamAverageResults, getPeerStats } from '../services/reports'

Chart.register(
  RadarController,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
  LineController,
  CategoryScale,
  LinearScale
)

const PFA_LOGO =
  'https://iilysafrbbnklelzzqyh.supabase.co/storage/v1/object/public/Assets/Peak%20Athletics%20Logo%202.png'

const TEST_RANGES = {
  '10m_sprint': { min: 1.5, max: 2.5, higherIsBetter: false },
  '30m_sprint': { min: 3.5, max: 5.5, higherIsBetter: false },
  pro_agility_shuttle: { min: 4.2, max: 6.2, higherIsBetter: false },
  squat: { min: 60, max: 400, higherIsBetter: true },
  trap_bar_deadlift: { min: 80, max: 500, higherIsBetter: true },
  bench_press: { min: 40, max: 300, higherIsBetter: true },
  pull_ups: { min: 0, max: 25, higherIsBetter: true },
  push_ups: { min: 0, max: 60, higherIsBetter: true },
  imtp: { min: 60, max: 400, higherIsBetter: true },
  broad_jump: { min: 130, max: 290, higherIsBetter: true },
  vertical_jump: { min: 20, max: 80, higherIsBetter: true },
  ncmj: { min: 20, max: 70, higherIsBetter: true },
  mb_chest_pass: { min: 2.5, max: 8.0, higherIsBetter: true },
  beep_test: { min: 4, max: 15, higherIsBetter: true },
}

const LOWER_IS_BETTER = new Set(['10m_sprint', '30m_sprint', 'pro_agility_shuttle'])

const CATEGORY_WEIGHTS = { speed: 0.3, strength: 0.15, power: 0.25, agility: 0.2, endurance: 0.1 }

const CATEGORIES = ['speed', 'strength', 'power', 'agility', 'endurance']

const CAT_DESCRIPTIONS = {
  speed: 'Linear speed is a critical physical quality across virtually every sport. Sprint times reflect the athlete\'s ability to accelerate and reach top velocity.',
  strength: 'Strength forms the foundation of athletic performance. Maximal and relative strength underpin power output, injury resilience, and long-term development.',
  power: 'Power reflects the rate of force development. Jump tests measure the neuromuscular capacity to express force quickly — essential for explosive athletic movements.',
  agility: 'Change-of-direction speed measures the athlete\'s ability to decelerate, reorient, and accelerate. Closely linked to reactive ability and coordination.',
  endurance: 'Aerobic capacity determines an athlete\'s ability to sustain high-intensity efforts and recover between bouts. Critical for repeat-sprint sports.',
}

const formatVal = (testType, value) => {
  if (value === null || value === undefined) return '—'
  const kgTests = ['squat', 'trap_bar_deadlift', 'bench_press', 'imtp']
  if (kgTests.includes(testType)) return `${parseFloat(value).toFixed(1)} kg`
  if (testType === 'broad_jump') return `${(value / 100).toFixed(2)} m`
  if (['10m_sprint', '30m_sprint', 'pro_agility_shuttle'].includes(testType)) return `${Number(value).toFixed(2)} s`
  if (['vertical_jump', 'ncmj'].includes(testType)) return `${Math.round(value)} cm`
  if (testType === 'beep_test') return `Level ${Number(value).toFixed(1)}`
  if (['pull_ups', 'push_ups'].includes(testType)) return `${Math.round(value)} reps`
  if (testType === 'mb_chest_pass') return `${Number(value).toFixed(2)} m`
  return parseFloat(Number(value).toFixed(1))
}

const normalizeScore = (testType, value, peerStats) => {
  if (value === null || value === undefined) return null

  // Z-score normalization when peer data exists
  const peer = peerStats?.find((s) => s.test_type === testType)
  if (peer && peer.std_dev && peer.n >= 5) {
    const z = (value - peer.mean) / peer.std_dev
    const LOWER_IS_BETTER = ['10m_sprint', '30m_sprint', 'pro_agility_shuttle']
    const adjustedZ = LOWER_IS_BETTER.includes(testType) ? -z : z
    return Math.round(Math.min(100, Math.max(0, 50 + adjustedZ * 15)))
  }

  // Fallback to fixed ranges
  const range = TEST_RANGES[testType]
  if (!range) return null
  const { min, max, higherIsBetter } = range
  if (higherIsBetter) {
    return Math.round(Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100)))
  }
  return Math.round(Math.min(100, Math.max(0, ((max - value) / (max - min)) * 100)))
}

const calcCategoryScores = (results, peerStats = []) => {
  const grouped = { speed: [], strength: [], power: [], agility: [], endurance: [] }
  const seen = new Set()
  const sorted = [...results].sort((a, b) => new Date(b.date_tested) - new Date(a.date_tested))
  for (const r of sorted) {
    if (seen.has(r.test_type)) continue
    seen.add(r.test_type)
    if (grouped[r.category]) {
      const s = normalizeScore(r.test_type, r.value, peerStats)
      if (s !== null) grouped[r.category].push(s)
    }
  }
  const scores = {}
  for (const cat of CATEGORIES) {
    const arr = grouped[cat]
    scores[cat] = arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null
  }
  const vals = CATEGORIES.filter((c) => scores[c] !== null).map((c) => scores[c] * CATEGORY_WEIGHTS[c])
  const weightSum = CATEGORIES.filter((c) => scores[c] !== null).reduce((s, c) => s + CATEGORY_WEIGHTS[c], 0)
  scores.overall = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / weightSum) : null
  return scores
}

const calcGroupAverageScores = (results) => {
  if (!results || !Array.isArray(results) || results.length === 0) {
    return { speed: 0, strength: 0, power: 0, agility: 0, endurance: 0, overall: 0 }
  }
  const byAthlete = {}
  for (const r of results) {
    if (!byAthlete[r.athlete_id]) byAthlete[r.athlete_id] = []
    byAthlete[r.athlete_id].push(r)
  }
  const catTotals = { speed: [], strength: [], power: [], agility: [], endurance: [] }
  for (const athleteResults of Object.values(byAthlete)) {
    const s = calcCategoryScores(athleteResults, [])
    for (const c of CATEGORIES) {
      if (s[c] !== null) catTotals[c].push(s[c])
    }
  }
  const avg = {}
  for (const c of CATEGORIES) {
    avg[c] = catTotals[c].length ? Math.round(catTotals[c].reduce((a, b) => a + b, 0) / catTotals[c].length) : 0
  }
  return avg
}

const calcAge = (dob) => {
  if (!dob) return '—'
  const today = new Date()
  const birth = new Date(dob)
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

const getScoreColor = (score) => {
  if (score === null) return '#4b5563'
  if (score >= 80) return '#3fae52'
  if (score >= 60) return '#a3e635'
  if (score >= 40) return '#facc15'
  return '#f87171'
}

const RADAR_DEFAULTS = (label, data, color, fill) => ({
  label,
  data,
  backgroundColor: fill,
  borderColor: color,
  borderWidth: 2,
  pointBackgroundColor: color,
  pointRadius: 3,
})

function RadarChartCanvas({ title, athleteScores, compScores, compLabel }) {
  const canvasRef = useRef(null)
  const chartRef = useRef(null)

  useEffect(() => {
    if (!canvasRef.current) return
    if (chartRef.current) chartRef.current.destroy()
    chartRef.current = new Chart(canvasRef.current, {
      type: 'radar',
      data: {
        labels: ['Speed', 'Strength', 'Power', 'Agility', 'Endurance'],
        datasets: [
          RADAR_DEFAULTS('Athlete', CATEGORIES.map((c) => athleteScores[c] ?? 0), '#3fae52', 'rgba(63,174,82,0.25)'),
          RADAR_DEFAULTS(compLabel, CATEGORIES.map((c) => compScores[c] ?? 0), 'rgba(255,255,255,0.6)', 'rgba(255,255,255,0.08)'),
        ],
      },
      options: {
        animation: false,
        scales: {
          r: {
            min: 0,
            max: 100,
            ticks: { display: false, stepSize: 20 },
            grid: { color: 'rgba(63,174,82,0.2)' },
            angleLines: { color: 'rgba(63,174,82,0.2)' },
            pointLabels: { color: 'rgba(255,255,255,0.7)', font: { size: 11 } },
          },
        },
        plugins: {
          legend: { labels: { color: 'rgba(255,255,255,0.7)', font: { size: 11 } } },
          tooltip: { enabled: true },
        },
      },
    })
    return () => chartRef.current?.destroy()
  }, [athleteScores, compScores, compLabel])

  return (
    <div style={{ background: '#0d1a0e', border: '1px solid rgba(63,174,82,0.2)', borderRadius: '12px', padding: '16px' }}>
      <div style={{ color: '#3fae52', fontWeight: '700', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px' }}>{title}</div>
      <canvas ref={canvasRef} style={{ maxHeight: '220px' }} />
    </div>
  )
}

function LineChartCanvas({ testType, history }) {
  const canvasRef = useRef(null)
  const chartRef = useRef(null)

  useEffect(() => {
    if (!canvasRef.current || history.length < 2) return
    if (chartRef.current) chartRef.current.destroy()
    chartRef.current = new Chart(canvasRef.current, {
      type: 'line',
      data: {
        labels: history.map((r) => r.date_tested?.slice(0, 10) ?? ''),
        datasets: [{
          label: testType.replaceAll('_', ' '),
          data: history.map((r) => r.value),
          borderColor: '#3fae52',
          backgroundColor: 'rgba(63,174,82,0.1)',
          borderWidth: 2,
          pointRadius: 4,
          pointBackgroundColor: '#3fae52',
          tension: 0.3,
          fill: true,
        }],
      },
      options: {
        animation: false,
        scales: {
          x: { ticks: { color: 'rgba(255,255,255,0.5)', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.05)' } },
          y: { ticks: { color: 'rgba(255,255,255,0.5)', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.05)' } },
        },
        plugins: { legend: { display: false } },
      },
    })
    return () => chartRef.current?.destroy()
  }, [testType, history])

  if (!history.length) return null
  if (history.length === 1) {
    return (
      <p style={{ color: 'rgba(63,174,82,0.5)', fontSize: '12px', marginTop: '8px' }}>
        Only 1 session recorded — chart will appear after next test
      </p>
    )
  }

  return <canvas ref={canvasRef} style={{ height: '120px', maxHeight: '120px' }} />
}

const Report = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user, profile: authProfile } = useAuth()
  const athleteId = searchParams.get('athleteId') || authProfile?.id

  const [reportData, setReportData] = useState({ profile: null, results: [], benchmarks: [] })
  const [pfaAvg, setPfaAvg] = useState({})
  const [teamAvg, setTeamAvg] = useState({})
  const [peerStats, setPeerStats] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [peakiqText, setPeakiqText] = useState(null)
  const [peakiqLoading, setPeakiqLoading] = useState(false)

  useEffect(() => {
    if (!athleteId) return
    const cacheKey = `peakiq_${athleteId}`
    const cached = localStorage.getItem(cacheKey)
    if (cached) setPeakiqText(cached)
  }, [athleteId])

  useEffect(() => {
    if (!athleteId) return
    const load = async () => {
      setLoading(true)
      try {
        const data = await getAthleteReport(athleteId)
        setReportData(data || { profile: null, results: [], benchmarks: [] })
        const [pfaResults, teamResults] = await Promise.all([
          getPfaAverageScores(data.profile?.sport, data.profile?.age_category),
          getTeamAverageResults(data.profile?.team_id),
        ])
        if (data.profile?.sport && data.profile?.age_category && data.profile?.gender) {
          const stats = await getPeerStats(data.profile.sport, data.profile.age_category, data.profile.gender)
          setPeerStats(Array.isArray(stats) ? stats : [])
        }
        setPfaAvg(calcGroupAverageScores(Array.isArray(pfaResults) ? pfaResults : []))
        setTeamAvg(calcGroupAverageScores(Array.isArray(teamResults) ? teamResults : []))
      } catch (err) {
        console.error('Report load error', err)
        setError(err.message)
      }
      setLoading(false)
    }
    load()
  }, [athleteId])

  const catScores = useMemo(() => {
    if (!reportData?.results) return {}
    return calcCategoryScores(reportData.results, peerStats)
  }, [reportData?.results, peerStats])

  const groupedResults = useMemo(() => {
    const map = { speed: [], strength: [], power: [], agility: [], endurance: [] }
    for (const r of (reportData?.results ?? [])) {
      if (map[r.category]) map[r.category].push(r)
    }
    return map
  }, [reportData?.results])

  const testHistories = useMemo(() => {
    const h = {}
    for (const r of (reportData?.results ?? [])) {
      if (!h[r.test_type]) h[r.test_type] = []
      h[r.test_type].push(r)
    }
    for (const key of Object.keys(h)) {
      h[key].sort((a, b) => new Date(a.date_tested) - new Date(b.date_tested))
    }
    return h
  }, [reportData?.results])

  const personalBests = useMemo(() => {
    const pb = {}
    for (const r of (reportData?.results ?? [])) {
      const isLower = LOWER_IS_BETTER.has(r.test_type)
      if (!pb[r.test_type]) {
        pb[r.test_type] = r
      } else {
        const better = isLower ? r.value < pb[r.test_type].value : r.value > pb[r.test_type].value
        if (better) pb[r.test_type] = r
      }
    }
    return pb
  }, [reportData?.results])

  const handleGenerateInsights = async () => {
    if (!athleteId) return
    setPeakiqLoading(true)
    try {
      const res = await fetch('/.netlify/functions/generate-analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ athleteId, audience: authProfile?.role ?? 'athlete' }),
      })
      const json = await res.json()
      const text = json.result || json.text || JSON.stringify(json)
      setPeakiqText(text)
      localStorage.setItem(`peakiq_${athleteId}`, text)
    } catch (err) {
      setPeakiqText('Failed to generate insights. Please try again later.')
    }
    setPeakiqLoading(false)
  }

  if (!athleteId) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0f0a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
        No athlete selected.
      </div>
    )
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0f0a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', flexDirection: 'column', gap: '16px' }}>
        <div style={{ width: '40px', height: '40px', border: '4px solid #3fae52', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <span style={{ color: 'rgba(255,255,255,0.6)' }}>Loading report...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0f0a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f87171', padding: '32px' }}>
        Error: {error}
      </div>
    )
  }

  const { profile, benchmarks } = reportData
  const age = calcAge(profile?.date_of_birth || profile?.dob)
  const initials = (profile?.full_name || 'NA').split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div style={{ background: '#0a0f0a', minHeight: '100vh', color: 'white', fontFamily: 'sans-serif', overflowX: 'hidden', width: '100%' }}>

      {/* BACK BUTTON */}
      <div style={{ padding: '16px 24px' }}>
        <button
          onClick={() => navigate(-1)}
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(63,174,82,0.3)', borderRadius: '8px', color: '#3fae52', padding: '8px 16px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}
        >
          ← Back
        </button>
      </div>

      {/* ── SECTION 1: ATHLETE HEADER ── */}
      <div style={{ background: 'linear-gradient(135deg, #0d1a0e, #1a2e1a)', borderBottom: '1px solid rgba(63,174,82,0.3)', padding: '32px 24px' }}>
        <div
          style={{
            maxWidth: '960px',
            margin: '0 auto',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '16px',
            alignItems: 'center',
            padding: '0',
          }}
        >

          {/* Photo */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.full_name} style={{ width: '96px', height: '96px', borderRadius: '50%', objectFit: 'cover', border: '3px solid #3fae52' }} />
            ) : (
              <div style={{ width: '96px', height: '96px', borderRadius: '50%', background: 'rgba(63,174,82,0.15)', border: '2px solid rgba(63,174,82,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', fontWeight: '800', color: '#3fae52' }}>
                {initials}
              </div>
            )}
            {profile?.position && (
              <span style={{ background: 'rgba(63,174,82,0.15)', border: '1px solid rgba(63,174,82,0.3)', borderRadius: '12px', padding: '2px 10px', fontSize: '11px', color: '#3fae52', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {profile.position}
              </span>
            )}
          </div>

          {/* Name + team */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
              <img src={PFA_LOGO} alt="PFA" style={{ width: '36px', height: '36px', objectFit: 'contain' }} />
              <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', fontWeight: '600', letterSpacing: '0.15em', textTransform: 'uppercase' }}>Performance Report</span>
            </div>
            <h1 style={{ fontSize: '32px', fontWeight: '900', letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 6px', lineHeight: 1.1 }}>
              {profile?.full_name || 'Athlete'}
            </h1>
            <div style={{ color: '#3fae52', fontSize: '13px', fontWeight: '600' }}>
              {profile?.pfa_teams?.name || profile?.team_name || '—'} {profile?.age_category ? `· ${profile.age_category}` : ''}
            </div>
          </div>

          {/* Info grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '8px', fontSize: '12px' }}>
            {[
              { label: 'Age', value: age },
              { label: 'DOB', value: profile?.date_of_birth?.slice(0, 10) || profile?.dob?.slice(0, 10) || '—' },
              { label: 'Sport', value: profile?.sport || '—' },
              { label: 'Level', value: profile?.competition_level || '—' },
            ].map(({ label, value }) => (
              <div key={label}>
                <div style={{ color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.1em' }}>{label}</div>
                <div style={{ color: 'white', fontWeight: '600', marginTop: '2px' }}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 16px', width: '100%' }}>

        <div style={{ maxWidth: '960px', margin: '0 auto', padding: '0 8px 64px', width: '100%' }}>

        {/* ── SECTION 2: COMPOSITE SCORES ── */}
        <div style={{ marginTop: '32px' }}>
          <div style={{ background: 'rgba(63,174,82,0.08)', borderBottom: '1px solid rgba(63,174,82,0.25)', padding: '12px 0', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#3fae52', fontWeight: '800', fontSize: '13px', letterSpacing: '0.15em', textTransform: 'uppercase' }}>Physical Performance Results</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px' }}>Overall Score</span>
              <span style={{ fontSize: '28px', fontWeight: '900', color: getScoreColor(catScores.overall) }}>{catScores.overall ?? '—'}</span>
            </div>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: '12px',
              width: '100%',
            }}
          >
            {CATEGORIES.map((cat) => {
              const score = catScores[cat]
              const color = getScoreColor(score)
              return (
                <div key={cat} style={{ background: '#0d1a0e', border: '1px solid rgba(63,174,82,0.2)', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
                  <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '8px' }}>{cat}</div>
                  <div style={{ fontSize: '36px', fontWeight: '900', color, lineHeight: 1 }}>{score ?? '—'}</div>
                  <div style={{ marginTop: '10px', height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${score ?? 0}%`, background: color, borderRadius: '2px' }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── SECTION 3: RADAR CHARTS ── */}
        <div style={{ marginTop: '40px' }}>
          <div style={{ color: '#3fae52', fontWeight: '800', fontSize: '13px', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '16px', borderBottom: '1px solid rgba(63,174,82,0.2)', paddingBottom: '8px' }}>
            Performance Comparisons
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '16px',
            }}
          >
            <RadarChartCanvas
              title="Athlete vs PFA Average"
              athleteScores={catScores}
              compScores={pfaAvg}
              compLabel="PFA Avg"
            />
            <RadarChartCanvas
              title="Athlete vs Team Average"
              athleteScores={catScores}
              compScores={teamAvg}
              compLabel="Team Avg"
            />
            <div style={{ background: '#0d1a0e', border: '1px solid rgba(63,174,82,0.2)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '240px' }}>
              <div style={{ color: '#3fae52', fontWeight: '700', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px' }}>Athlete vs Game Stats</div>
              <div style={{ color: 'rgba(63,174,82,0.5)', fontSize: '13px', textAlign: 'center', lineHeight: 1.6 }}>Game Statistics Not Available — Stats will appear here once recorded</div>
            </div>
          </div>
        </div>

        {/* ── SECTION 4: PER CATEGORY BREAKDOWN ── */}
        <div style={{ marginTop: '48px' }}>
          <div style={{ color: '#3fae52', fontWeight: '800', fontSize: '13px', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '20px', borderBottom: '1px solid rgba(63,174,82,0.2)', paddingBottom: '8px' }}>
            Category Breakdown
          </div>
          {CATEGORIES.map((cat) => {
            const results = groupedResults[cat] || []
            const catTestTypes = [...new Set(results.map((r) => r.test_type))]
            return (
              <div key={cat} style={{ marginBottom: '40px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <h3 style={{ fontWeight: '800', fontSize: '18px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'white', margin: 0 }}>{cat}</h3>
                  <span style={{ fontSize: '22px', fontWeight: '900', color: getScoreColor(catScores[cat]) }}>{catScores[cat] ?? '—'}</span>
                </div>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', lineHeight: 1.6, marginBottom: '16px' }}>{CAT_DESCRIPTIONS[cat]}</p>
                {catTestTypes.length === 0 && (
                  <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '13px', padding: '16px', background: '#0d1a0e', borderRadius: '8px' }}>No results recorded yet</div>
                )}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                    gap: '16px',
                  }}
                >
                  {catTestTypes.map((tt) => {
                    const pb = personalBests[tt]
                    const history = testHistories[tt] || []
                    const relevant = (benchmarks || []).filter((b) => b.test_type === tt)
                    const pfaBench = relevant.find((b) => b.source === 'pfa_internal')
                    const hnbBench = relevant.find((b) => b.source === 'hnb')
                    const hcBench = relevant.find((b) => b.source === 'hc')
                    return (
                      <div key={tt} style={{ background: '#0d1a0e', border: '1px solid rgba(63,174,82,0.15)', borderRadius: '12px', padding: '16px' }}>
                        <div style={{ color: '#3fae52', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>
                          {tt.replaceAll('_', ' ')}
                        </div>
                        <div style={{ fontSize: '22px', fontWeight: '900', color: 'white', marginBottom: '12px' }}>
                          {pb ? formatVal(tt, pb.value) : '—'}
                          <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginLeft: '6px', fontWeight: '400' }}>Personal Best</span>
                        </div>
                        {history.length > 1 && <LineChartCanvas testType={tt} history={history} />}
                        {(pfaBench || hnbBench || hcBench) && (
                          <div style={{ marginTop: '12px', borderTop: '1px solid rgba(63,174,82,0.1)', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {pfaBench && (
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                                <span style={{ color: 'rgba(255,255,255,0.4)' }}>PFA Average</span>
                                <span style={{ color: '#3fae52', fontWeight: '600' }}>{formatVal(tt, pfaBench.value)}</span>
                              </div>
                            )}
                            {hnbBench && (
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                                <span style={{ color: 'rgba(255,255,255,0.4)' }}>HNB Standard</span>
                                <span style={{ color: 'rgba(255,255,255,0.6)', fontWeight: '600' }}>{formatVal(tt, hnbBench.value)}</span>
                              </div>
                            )}
                            {hcBench && (
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                                <span style={{ color: 'rgba(255,255,255,0.4)' }}>Hockey Canada</span>
                                <span style={{ color: 'rgba(255,255,255,0.6)', fontWeight: '600' }}>{formatVal(tt, hcBench.value)}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        {/* ── SECTION 5: PEAKIQ INSIGHTS ── */}
        <div style={{ marginTop: '48px', background: '#0d1a0e', border: '1px solid rgba(63,174,82,0.25)', borderRadius: '16px', padding: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <img src={PFA_LOGO} alt="PFA" style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
            <span style={{ color: '#3fae52', fontWeight: '900', fontSize: '18px', letterSpacing: '0.08em' }}>PeakIQ Insights</span>
          </div>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', lineHeight: 1.7, marginBottom: '24px', maxWidth: '600px' }}>
            PeakIQ analyzes your data to deliver a full breakdown of your testing performance — including benchmarks, gaps, strengths, and priorities for growth.
          </p>
          {!peakiqText && !peakiqLoading && (
            <button
              onClick={handleGenerateInsights}
              style={{ background: '#3fae52', color: '#000', fontWeight: '800', fontSize: '14px', padding: '14px 32px', borderRadius: '24px', border: 'none', cursor: 'pointer', letterSpacing: '0.05em' }}
            >
              Generate Insights
            </button>
          )}
          {peakiqLoading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'rgba(255,255,255,0.6)', fontSize: '14px' }}>
              <div style={{ width: '20px', height: '20px', border: '3px solid #3fae52', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              Analyzing your performance data...
            </div>
          )}
          {peakiqText && !peakiqLoading && (
            <div>
              <div style={{ whiteSpace: 'pre-wrap', color: 'rgba(255,255,255,0.85)', fontSize: '14px', lineHeight: 1.8, background: 'rgba(0,0,0,0.3)', borderRadius: '10px', padding: '20px', borderLeft: '3px solid #3fae52' }}>
                {peakiqText}
              </div>
              <button
                onClick={() => { setPeakiqText(null); localStorage.removeItem(`peakiq_${athleteId}`) }}
                style={{ marginTop: '12px', background: 'transparent', border: '1px solid rgba(63,174,82,0.3)', color: 'rgba(255,255,255,0.5)', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px' }}
              >
                Regenerate
              </button>
            </div>
          )}
        </div>

        {/* ── SECTION 6: FOOTER ── */}
        <footer style={{ marginTop: '64px', borderTop: '1px solid rgba(63,174,82,0.15)', paddingTop: '32px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', marginBottom: '32px' }}>
            <div>
              <div style={{ color: '#3fae52', fontWeight: '700', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '10px' }}>Testing Protocols & Methodology</div>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', lineHeight: 1.7 }}>
                All testing is conducted by certified PFA staff using standardized protocols consistent with CSC, NSCA, and Hockey Canada development standards. Results are normalized against peer cohorts of matching sport, age category, and competition level to provide meaningful context for development decisions.
              </p>
            </div>
            <div>
              <div style={{ color: '#3fae52', fontWeight: '700', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '10px' }}>Scouting & Development Context</div>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', lineHeight: 1.7 }}>
                Physical performance data should be interpreted alongside technical, tactical, and psychological indicators. Composite scores reflect relative performance within peer groups and are intended to inform training priorities — not define athletic potential. Use in conjunction with coach evaluation for complete player profiling.
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <img src={PFA_LOGO} alt="Peak Athletics" style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
              <div>
                <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px' }}>688 Babin St, Dieppe, NB, E1A 5M1</div>
                <div style={{ color: '#3fae52', fontSize: '12px' }}>info@peakfitnessdieppe.ca</div>
              </div>
            </div>
            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px' }}>© 2026 Peak Fitness Athletics — All Rights Reserved</div>
          </div>
        </footer>
      </div>
    </div>
  </div>
  )
}

export default Report
