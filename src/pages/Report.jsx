import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
import { getAthleteReport, getAgeGroupAverageResults, getPeerStats, getAthleteGameStats } from '../services/reports'
import { supabase } from '../services/supabase'

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

const STRENGTH_LOAD_TESTS = ['squat', 'bench_press', 'trap_bar_deadlift']
const LOWER_IS_BETTER = ['10m_sprint', 'pro_agility_shuttle']
const calcE1RM = (load, reps) => (!load || !reps || reps === 1) ? load : Math.round(load * (1 + reps / 30))

const TEST_RANGES = {
  '10m_sprint': { min: 1.5, max: 2.5, higherIsBetter: false },
  pro_agility_shuttle: { min: 4.2, max: 6.2, higherIsBetter: false },
  squat: { min: 60, max: 400, higherIsBetter: true },
  trap_bar_deadlift: { min: 80, max: 500, higherIsBetter: true },
  bench_press: { min: 40, max: 300, higherIsBetter: true },
  pull_ups: { min: 0, max: 25, higherIsBetter: true },
  push_ups: { min: 0, max: 60, higherIsBetter: true },
  broad_jump: { min: 130, max: 290, higherIsBetter: true },
  vertical_jump: { min: 20, max: 80, higherIsBetter: true },
  mb_chest_pass: { min: 2.5, max: 8.0, higherIsBetter: true },
  beep_test: { min: 4, max: 15, higherIsBetter: true },
}

const LOWER_IS_BETTER_SET = new Set(LOWER_IS_BETTER)

const deduplicateByBestPerDay = (results, testType) => {
  const byDay = {}
  results.forEach((r) => {
    if (!r?.date_tested) return
    const day = r.date_tested.split('T')[0]
    if (!byDay[day]) {
      byDay[day] = r
    } else {
      const current = byDay[day].value
      const incoming = r.value
      if (LOWER_IS_BETTER.includes(testType)) {
        if (incoming < current) byDay[day] = r
      } else {
        if (incoming > current) byDay[day] = r
      }
    }
  })
  return Object.values(byDay).sort((a, b) => new Date(a.date_tested) - new Date(b.date_tested))
}

const CATEGORY_WEIGHTS = { speed: 0.25, power: 0.25, strength: 0.25, agility: 0.15, endurance: 0.1 }

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
  const lbTests = ['squat', 'trap_bar_deadlift', 'bench_press', 'imtp']
  if (lbTests.includes(testType)) return `${parseFloat(value).toFixed(1)} lbs`
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
    const LOWER_IS_BETTER_LOCAL = ['10m_sprint', '30m_sprint', 'pro_agility_shuttle']
    const adjustedZ = LOWER_IS_BETTER_LOCAL.includes(testType) ? -z : z
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
  const catTotals = { speed: [], strength: [], power: [], agility: [], endurance: [], overall: [] }
  for (const athleteResults of Object.values(byAthlete)) {
    const s = calcCategoryScores(athleteResults, [])
    for (const c of CATEGORIES) {
      if (s[c] !== null) catTotals[c].push(s[c])
    }
    if (s.overall !== null) catTotals.overall.push(s.overall)
  }
  const avg = {}
  for (const c of [...CATEGORIES, 'overall']) {
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

const RADAR_DEFAULTS = (label, data, color, fill, pointColor) => ({
  label,
  data,
  backgroundColor: fill,
  borderColor: color,
  borderWidth: 2,
  pointBackgroundColor: pointColor || color,
  pointRadius: 3,
})

function RadarChartCanvas({ title, athleteScores, compScores, compLabel }) {
  const canvasRef = useRef(null)
  const chartRef = useRef(null)

  useEffect(() => {
    if (!canvasRef.current) return
    if (chartRef.current) {
      chartRef.current.destroy()
      chartRef.current = null
    }
    const hasAthleteData = athleteScores && Object.values(athleteScores).some((v) => v > 0)
    if (!hasAthleteData) return
    chartRef.current = new Chart(canvasRef.current, {
      type: 'radar',
      data: {
        labels: ['Speed', 'Strength', 'Power', 'Agility', 'Endurance'],
        datasets: [
          RADAR_DEFAULTS('Athlete', CATEGORIES.map((c) => athleteScores[c] ?? 0), '#3fae52', 'rgba(63,174,82,0.15)'),
          RADAR_DEFAULTS(compLabel, CATEGORIES.map((c) => compScores[c] ?? 0), 'rgba(255,255,255,0.3)', 'rgba(255,255,255,0.08)', '#ffffff'),
        ],
      },
      options: {
        animation: false,
        scales: {
          r: {
            min: 0,
            max: 100,
            ticks: { display: false, stepSize: 20 },
            grid: { color: 'rgba(255,255,255,0.1)' },
            angleLines: { color: 'rgba(255,255,255,0.1)' },
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
  }, [athleteScores, compScores, compLabel, title])

  return (
    <div style={{ background: '#0d1a0e', border: '1px solid rgba(63,174,82,0.2)', borderRadius: '12px', padding: '16px' }}>
      <div style={{ color: '#3fae52', fontWeight: '700', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px' }}>{title}</div>
      <canvas ref={canvasRef} style={{ height: '350px', maxHeight: '350px', background: 'transparent' }} />
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
  const { user } = useAuth()
  const athleteId = (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('id') : null) || user?.id

  const [reportData, setReportData] = useState({ profile: null, results: [], benchmarks: [] })
  const [ageGroupAvg, setAgeGroupAvg] = useState({})
  const [peerStats, setPeerStats] = useState([])
  const [gameStats, setGameStats] = useState([])
  const [allTestResults, setAllTestResults] = useState([])
  const [allCompositeScores, setAllCompositeScores] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [compScore, setCompScore] = useState(null)
  const [latestMeasurement, setLatestMeasurement] = useState(null)
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 640 : false)
  const [insights, setInsights] = useState(null)
  const [insightsLoading, setInsightsLoading] = useState(false)

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640)
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', handleResize)
      return () => window.removeEventListener('resize', handleResize)
    }
  }, [])

  useEffect(() => {
    if (!athleteId) return
    const load = async () => {
      setLoading(true)
      try {
        const data = await getAthleteReport(athleteId)
        setReportData(data || { profile: null, results: [], benchmarks: [] })
        const [ageGroupResults] = await Promise.all([
          getAgeGroupAverageResults(data.profile?.sport, data.profile?.age_category, data.profile?.gender),
        ])
        if (data.profile?.sport && data.profile?.age_category && data.profile?.gender) {
          const stats = await getPeerStats(data.profile.sport, data.profile.age_category, data.profile.gender)
          setPeerStats(Array.isArray(stats) ? stats : [])
        }
        const gs = await getAthleteGameStats(athleteId)
        setGameStats(gs || [])
        setAgeGroupAvg(calcGroupAverageScores(Array.isArray(ageGroupResults) ? ageGroupResults : []))

        const { data: compScoreData } = await supabase
          .from('pfa_composite_scores')
          .select('overall_score, speed_score, power_score, strength_score, agility_score, endurance_score, calculated_at')
          .eq('athlete_id', athleteId)
          .order('calculated_at', { ascending: false })
          .limit(1)
        setCompScore(compScoreData?.[0] || null)

        const { data: allCompScoresData } = await supabase
          .from('pfa_composite_scores')
          .select('*')
          .eq('athlete_id', athleteId)
          .order('calculated_at', { ascending: true })
        setAllCompositeScores(allCompScoresData || [])

        const { data: allTestsData } = await supabase
          .from('pfa_test_results')
          .select('*')
          .eq('athlete_id', athleteId)
          .order('date_tested', { ascending: true })
        setAllTestResults(allTestsData || [])

        const { data: gsAll } = await supabase
          .from('game_stats')
          .select('*')
          .eq('athlete_id', athleteId)
          .eq('sport', 'Hockey')
          .order('season', { ascending: true })
        if (gsAll) setGameStats(gsAll)

        const { data: bodyData } = await supabase
          .from('pfa_body_measurements')
          .select('height, weight, measurement_date')
          .eq('athlete_id', athleteId)
          .order('measurement_date', { ascending: false })
          .limit(1)
        setLatestMeasurement(bodyData?.[0] || null)
      } catch (err) {
        console.error('Report load error', err)
        setError(err.message)
      }
      setLoading(false)
    }
    load()
  }, [athleteId])

  useEffect(() => {
    if (!athleteId) return
    const fetchInsights = async () => {
      setInsightsLoading(true)
      try {
        const { data: cached } = await supabase
          .from('pfa_ai_insights')
          .select('insight_json, generated_at')
          .eq('athlete_id', athleteId)
          .single()

        if (cached?.insight_json) {
          setInsights(cached.insight_json)
          setInsightsLoading(false)
          return
        }

        const res = await fetch('/.netlify/functions/generate-analytics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ athleteId }),
        })
        const data = await res.json()
        if (data?.insight) setInsights(data.insight)
      } catch (err) {
        console.error('Insights fetch error:', err)
      } finally {
        setInsightsLoading(false)
      }
    }
    fetchInsights()
  }, [athleteId])

  const peerAvg = ageGroupAvg

  const groupedResults = useMemo(() => {
    const map = { speed: [], strength: [], power: [], agility: [], endurance: [] }
    for (const r of (reportData?.results ?? [])) {
      if (map[r.category]) map[r.category].push(r)
    }
    return map
  }, [reportData?.results])

  const getTestSeries = (testType) => (allTestResults || []).filter((r) => r.test_type === testType).sort((a, b) => new Date(a.date_tested) - new Date(b.date_tested))

  const formatDiff = (num, unit) => {
    if (num == null || Number.isNaN(num)) return '—'
    const sign = num > 0 ? '+' : num < 0 ? '' : ''
    return `${sign}${num.toFixed(2)}${unit}`
  }

  const speedSeries = getTestSeries('10m_sprint')
  const powerSeriesVJ = getTestSeries('vertical_jump')
  const powerSeriesBJ = getTestSeries('broad_jump')
  const agilitySeries = deduplicateByBestPerDay(getTestSeries('pro_agility_shuttle'), 'pro_agility_shuttle')

  const buildStrengthSeries = (type) => getTestSeries(type).filter((r) => r.load_value)
  const strengthSeriesSquat = buildStrengthSeries('squat')
  const strengthSeriesTBDL = buildStrengthSeries('trap_bar_deadlift')
  const benchSeries = deduplicateByBestPerDay(
    buildStrengthSeries('bench_press').map((r) => ({ ...r, value: calcE1RM(r.load_value, r.reps) })),
    'bench_press'
  )
  const trapSeries = deduplicateByBestPerDay(
    buildStrengthSeries('trap_bar_deadlift').map((r) => ({ ...r, value: calcE1RM(r.load_value, r.reps) })),
    'trap_bar_deadlift'
  )
  const verticalJumpSeries = deduplicateByBestPerDay(powerSeriesVJ, 'vertical_jump')
  const beepSeries = deduplicateByBestPerDay(getTestSeries('beep_test'), 'beep_test')

  const latestScoresTimeline = allCompositeScores || []

  const hockeyCareerRows = useMemo(() => {
    const rows = (gameStats || []).filter((r) => {
      const gp = r.games_played || 0
      const team = (r.team_name || r.teamName || '').trim()
      if (!team) return false
      return gp > 0
    })

    const bestBySeason = {}
    for (const r of rows) {
      const key = r.season || ''
      const existing = bestBySeason[key]
      if (!existing || (r.games_played || 0) > (existing.games_played || 0)) {
        bestBySeason[key] = r
      }
    }

    const deduped = Object.values(bestBySeason)
    deduped.sort((a, b) => (b.season || '').localeCompare(a.season || ''))
    return deduped
  }, [gameStats])

  const testHistories = useMemo(() => {
    const h = {}
    for (const r of (reportData?.results ?? [])) {
      if (!h[r.test_type]) h[r.test_type] = []
      h[r.test_type].push(r)
    }
    for (const key of Object.keys(h)) {
      h[key] = deduplicateByBestPerDay(h[key], key)
    }
    return h
  }, [reportData?.results])

  const personalBests = useMemo(() => {
    const pb = {}
    for (const r of (reportData?.results ?? [])) {
      const isLower = LOWER_IS_BETTER_SET.has(r.test_type)
      if (!pb[r.test_type]) {
        pb[r.test_type] = r
      } else {
        const better = isLower ? r.value < pb[r.test_type].value : r.value > pb[r.test_type].value
        if (better) pb[r.test_type] = r
      }
    }
    return pb
  }, [reportData?.results])

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
  const firstName = (profile?.full_name || 'Athlete').split(' ')[0]
  const pronoun = profile?.gender === 'female' ? 'her' : 'his'

  const formatHeight = (inches) => {
    if (inches == null) return '—'
    const ft = Math.floor(inches / 12)
    const inch = Math.round(inches % 12)
    return `${ft}'${inch}"`
  }

  const heroHeight = formatHeight(latestMeasurement?.height ?? profile?.height ?? profile?.height_inches)
  const heroWeightValue = latestMeasurement?.weight ?? profile?.weight
  const heroWeight = heroWeightValue != null ? `${Math.round(heroWeightValue)} lbs` : '—'

  const displayScores = {
    overall: compScore?.overall_score != null ? Math.round(compScore.overall_score) : null,
    speed: compScore?.speed_score != null ? Math.round(compScore.speed_score) : null,
    power: compScore?.power_score != null ? Math.round(compScore.power_score) : null,
    strength: compScore?.strength_score != null ? Math.round(compScore.strength_score) : null,
    agility: compScore?.agility_score != null ? Math.round(compScore.agility_score) : null,
    endurance: compScore?.endurance_score != null ? Math.round(compScore.endurance_score) : null,
  }

  return (
    <div style={{ background: '#050705', minHeight: '100vh', color: 'white', fontFamily: 'sans-serif', overflowX: 'hidden', width: '100%' }}>

      {/* BACK BUTTON */}
      <div style={{ padding: '16px 24px' }}>
        <button
          onClick={() => navigate(-1)}
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(63,174,82,0.3)', borderRadius: '8px', color: '#3fae52', padding: '8px 16px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}
        >
          ← Back
        </button>
      </div>

      {/* ── SECTION 1: ATHLETE HERO ── */}
      <div
        style={{
          width: '100%',
          minHeight: '220px',
          backgroundColor: '#050705',
          position: 'relative',
          overflow: 'hidden',
          overflowX: 'hidden',
          padding: isMobile ? '24px 16px 0 16px' : '40px 24px 0 24px',
        }}
      >
        <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '40px 24px 0 24px' }}>
          <div style={{
            display: 'flex',
            flexDirection: window.innerWidth < 768 ? 'column' : 'row',
            gap: '32px',
            alignItems: window.innerWidth < 768 ? 'flex-start' : 'center'
          }}>

            <div style={{ flexShrink: 0 }}>
              <img
                src={profile?.avatar_url || '/placeholder-athlete.png'}
                alt={profile?.full_name}
                style={{
                  width: window.innerWidth < 768 ? '100%' : '280px',
                  height: window.innerWidth < 768 ? '320px' : '320px',
                  objectFit: 'cover',
                  objectPosition: 'top',
                  borderRadius: '8px',
                  display: 'block'
                }}
              />
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <img
                  src={PFA_LOGO}
                  alt="PFA"
                  style={{
                    height: '72px',
                    width: 'auto',
                    flexShrink: 0,
                    filter: 'drop-shadow(0 0 8px rgba(63,174,82,0.4))'
                  }}
                />
                <span style={{
                  fontSize: '14px',
                  fontWeight: '500',
                  letterSpacing: '0.05em',
                  color: 'rgba(255,255,255,0.7)',
                  lineHeight: 1.3
                }}>
                  PFA Performance & Development Report
                </span>
              </div>

              <h1 style={{
                fontSize: 'clamp(2rem, 5vw, 3.5rem)',
                fontWeight: '900',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: 'white',
                margin: '0 0 12px 0',
                lineHeight: 1.1
              }}>
                {profile?.full_name || 'Athlete'}
              </h1>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                {profile?.position && (
                  <span
                    style={{
                      background: '#3fae52',
                      color: '#000',
                      fontWeight: 800,
                      padding: '6px 12px',
                      borderRadius: '6px',
                      letterSpacing: '0.12em',
                      fontSize: '11px',
                      textTransform: 'uppercase',
                    }}
                  >
                    {profile.position}
                  </span>
                )}
                <span style={{ color: '#9ce6a8', fontWeight: 700, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {profile?.pfa_teams?.name || profile?.team_name || '—'}
                </span>
              </div>

              <div
                style={{
                  display: isMobile ? 'grid' : 'flex',
                  gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : undefined,
                  flexWrap: isMobile ? 'wrap' : 'nowrap',
                  gap: '10px',
                  alignItems: 'stretch',
                  width: '100%',
                }}
              >
                {[ 
                  { label: 'HT', value: heroHeight },
                  { label: 'WT', value: heroWeight },
                  { label: 'AGE', value: age },
                  { label: 'LEVEL', value: profile?.competition_level || '—' },
                  { label: 'SPORT', value: profile?.sport || '—' },
                ].map((item, idx, arr) => (
                  <div
                    key={item.label}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '8px 10px',
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.05)',
                      borderLeft: '3px solid rgba(63,174,82,0.6)',
                      flex: isMobile ? (item.label === 'SPORT' ? '0 0 100%' : '0 0 calc(50% - 8px)') : '0 0 auto',
                      overflow: 'hidden',
                    }}
                  >
                    <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px', letterSpacing: '0.14em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</div>
                    <div style={{ color: 'white', fontWeight: 800, fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.value}</div>
                    {idx !== arr.length - 1 && !isMobile && <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.05)' }} />}
                  </div>
                ))}
              </div>

            </div>
          </div>
        </div>
      </div>

      {insights?.this_season && (
        <div style={{
          maxWidth: '1100px',
          margin: '32px auto 40px auto',
          padding: isMobile ? '0 16px' : '0 24px',
          fontSize: '1.05rem',
          color: 'rgba(255,255,255,0.8)',
          fontStyle: 'italic',
          lineHeight: 1.7,
          borderLeft: '3px solid #3fae52',
          paddingLeft: '16px'
        }}>
          {insights.this_season}
        </div>
      )}

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 16px', width: '100%' }}>

        <div style={{ maxWidth: '960px', margin: '0 auto', padding: '0 8px 64px', width: '100%' }}>

        {/* ── SECTION 2: ATHLETE DEVELOPMENT ── */}
        <div style={{ marginTop: '32px', borderTop: '2px solid #3fae52', paddingTop: '20px' }}>
          <div style={{ color: '#3fae52', fontWeight: '800', fontSize: '13px', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '16px' }}>
            Athlete Development
          </div>

          {/* Block 1: Physical Highlights */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
            {/* Speed Callout */}
            {(() => {
              const series = speedSeries
              if (!series.length) return null
              const first = series[0]
              const last = series[series.length - 1]
              const hasComparison = series.length > 1
              const diff = hasComparison ? (Number(first.value) - Number(last.value)) : null // lower is better
              const improved = hasComparison && diff > 0
              const regressed = hasComparison && diff < 0
              let displayVal = `${Number(last.value).toFixed(2)}s`
              if (improved) displayVal = `${Math.abs(diff || 0).toFixed(2)}s faster`
              if (regressed) displayVal = `${Math.abs(diff || 0).toFixed(2)}s slower`
              const numberColor = regressed ? '#f59e0b' : diff != null ? '#3fae52' : 'white'
              const subtitle = improved
                ? 'Acceleration improving — trending in the right direction'
                : regressed
                  ? 'Acceleration has slowed since last test — flagged for attention'
                  : 'Current acceleration benchmark'
              return (
                <div style={{ background: '#0d1a0d', borderLeft: '3px solid #3fae52', padding: '16px', borderRadius: '10px', flex: '1 1 160px', minWidth: '140px', maxWidth: 'calc(50% - 8px)', wordBreak: 'break-word', overflow: 'hidden' }}>
                  <div style={{ color: numberColor, fontSize: 'clamp(1.5rem, 4vw, 2.5rem)', fontWeight: 900, lineHeight: 1 }}>
                    {displayVal}
                  </div>
                  <div style={{ color: 'rgba(63,174,82,0.8)', fontSize: 'clamp(9px, 2vw, 11px)', letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: '6px' }}>Sprint Speed</div>
                  <div style={{ color: regressed ? '#f59e0b' : 'rgba(255,255,255,0.65)', fontSize: 'clamp(10px, 2vw, 13px)', marginTop: '6px', fontStyle: 'italic' }}>
                    {subtitle}
                  </div>
                </div>
              )
            })()}

            {/* Power Callout */}
            {(() => {
              let series = powerSeriesVJ
              let label = 'Explosive Power'
              let subtitleImprove = 'Vertical jump improvement at Peak Fitness'
              let subtitlePB = 'Current power benchmark'
              if (!series.length && powerSeriesBJ.length) {
                series = powerSeriesBJ
                label = 'Broad Jump'
                subtitleImprove = 'Improvement at Peak Fitness'
                subtitlePB = 'Current power benchmark'
              }
              if (!series.length) return null
              const first = series[0]
              const last = series[series.length - 1]
              const hasComparison = series.length > 1
              const diff = hasComparison ? (Number(last.value) - Number(first.value)) : null
              const improved = hasComparison && diff > 0
              const regressed = hasComparison && diff < 0
              const magnitude = Math.abs(diff || 0)
              const displayVal = hasComparison ? `${regressed ? '-' : '+'}${magnitude.toFixed(0)} cm` : `${Number(last.value).toFixed(0)} cm`
              const numberColor = regressed ? '#f59e0b' : diff != null ? '#3fae52' : 'white'
              const subtitle = improved
                ? 'Explosive power trending up'
                : regressed
                  ? 'Power output declined since last test — flagged for attention'
                  : subtitlePB
              return (
                <div style={{ background: '#0d1a0d', borderLeft: '3px solid #3fae52', padding: '16px', borderRadius: '10px', flex: '1 1 160px', minWidth: '140px', maxWidth: 'calc(50% - 8px)', wordBreak: 'break-word', overflow: 'hidden' }}>
                  <div style={{ color: numberColor, fontSize: 'clamp(1.5rem, 4vw, 2.5rem)', fontWeight: 900, lineHeight: 1 }}>
                    {displayVal}
                  </div>
                  <div style={{ color: 'rgba(63,174,82,0.8)', fontSize: 'clamp(9px, 2vw, 11px)', letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: '6px' }}>{label}</div>
                  <div style={{ color: regressed ? '#f59e0b' : 'rgba(255,255,255,0.65)', fontSize: 'clamp(10px, 2vw, 13px)', marginTop: '6px', fontStyle: 'italic' }}>
                    {subtitle}
                  </div>
                </div>
              )
            })()}

            {/* Strength Callout */}
            {(() => {
              let series = strengthSeriesSquat
              let label = 'Squat Strength'
              let subtitleImprove = 'e1RM improvement at Peak Fitness'
              let subtitlePB = 'Estimated 1-rep max'
              if (!series.length && strengthSeriesTBDL.length) {
                series = strengthSeriesTBDL
                label = 'Trap Bar Deadlift Strength'
                subtitleImprove = 'e1RM improvement at Peak Fitness'
                subtitlePB = 'Estimated 1-rep max'
              }
              if (!series.length) return null
              const e1s = series.map((r) => calcE1RM(r.load_value, r.reps)).filter((v) => v != null)
              if (!e1s.length) return null
              const first = e1s[0]
              const last = e1s[e1s.length - 1]
              const hasComparison = e1s.length > 1
              const diff = hasComparison ? (last - first) : null
              const improved = hasComparison && diff > 0
              const regressed = hasComparison && diff < 0
              const displayVal = hasComparison ? `${regressed ? '-' : '+'}${Math.round(Math.abs(diff || 0))} lbs` : `${Math.round(last)} lbs`
              const numberColor = regressed ? '#f59e0b' : diff != null ? '#3fae52' : 'white'
              const subtitle = improved
                ? 'Strength trending up'
                : regressed
                  ? 'Strength output declined since last test — flagged for attention'
                  : subtitlePB
              return (
                <div style={{ background: '#0d1a0d', borderLeft: '3px solid #3fae52', padding: '16px', borderRadius: '10px', flex: '1 1 160px', minWidth: '140px', maxWidth: 'calc(50% - 8px)', wordBreak: 'break-word', overflow: 'hidden' }}>
                  <div style={{ color: numberColor, fontSize: 'clamp(1.5rem, 4vw, 2.5rem)', fontWeight: 900, lineHeight: 1 }}>
                    {displayVal}
                  </div>
                  <div style={{ color: 'rgba(63,174,82,0.8)', fontSize: 'clamp(9px, 2vw, 11px)', letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: '6px' }}>{label}</div>
                  <div style={{ color: regressed ? '#f59e0b' : 'rgba(255,255,255,0.65)', fontSize: 'clamp(10px, 2vw, 13px)', marginTop: '6px', fontStyle: 'italic' }}>
                    {subtitle}
                  </div>
                </div>
              )
            })()}

            {/* Agility Callout */}
            {(() => {
              const series = agilitySeries
              if (!series.length) return null
              if (series.length >= 2) {
                const first = series[0]
                const last = series[series.length - 1]
                const improvement = Number(first.value) - Number(last.value)
                return (
                  <div style={{ background: '#0d1a0d', borderLeft: '3px solid #3fae52', padding: '16px', borderRadius: '10px', flex: '1 1 160px', minWidth: '140px', maxWidth: 'calc(50% - 8px)', wordBreak: 'break-word', overflow: 'hidden' }}>
                    <div style={{ color: '#3fae52', fontSize: 'clamp(1.5rem, 4vw, 2.5rem)', fontWeight: 900, lineHeight: 1 }}>
                      {`${improvement.toFixed(2)}s faster`}
                    </div>
                    <div style={{ color: 'rgba(63,174,82,0.8)', fontSize: 'clamp(9px, 2vw, 11px)', letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: '6px' }}>AGILITY</div>
                    <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 'clamp(10px, 2vw, 13px)', marginTop: '6px', fontStyle: 'italic' }}>
                      Change of direction improving
                    </div>
                  </div>
                )
              }
              const best = series[series.length - 1]
              return (
                <div style={{ background: '#0d1a0d', borderLeft: '3px solid #3fae52', padding: '16px', borderRadius: '10px', flex: '1 1 160px', minWidth: '140px', maxWidth: 'calc(50% - 8px)', wordBreak: 'break-word', overflow: 'hidden' }}>
                  <div style={{ color: 'white', fontSize: 'clamp(1.5rem, 4vw, 2.5rem)', fontWeight: 900, lineHeight: 1 }}>
                    {`${Number(best.value).toFixed(2)}s`}
                  </div>
                  <div style={{ color: 'rgba(63,174,82,0.8)', fontSize: 'clamp(9px, 2vw, 11px)', letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: '6px' }}>PRO AGILITY</div>
                  <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 'clamp(10px, 2vw, 13px)', marginTop: '6px', fontStyle: 'italic' }}>
                    Current agility benchmark
                  </div>
                </div>
              )
            })()}

            {/* Bench Press Callout */}
            {(() => {
              const series = benchSeries
              if (!series.length) return null
              if (series.length >= 2) {
                const first = series[0]
                const last = series[series.length - 1]
                const diff = Number(last.value) - Number(first.value)
                return (
                  <div style={{ background: '#0d1a0d', borderLeft: '3px solid #3fae52', padding: '16px', borderRadius: '10px', flex: '1 1 160px', minWidth: '140px', maxWidth: 'calc(50% - 8px)', wordBreak: 'break-word', overflow: 'hidden' }}>
                    <div style={{ color: '#3fae52', fontSize: 'clamp(1.5rem, 4vw, 2.5rem)', fontWeight: 900, lineHeight: 1 }}>
                      {`${diff >= 0 ? '+' : ''}${Math.round(diff)} lbs`}
                    </div>
                    <div style={{ color: 'rgba(63,174,82,0.8)', fontSize: 'clamp(9px, 2vw, 11px)', letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: '6px' }}>BENCH PRESS</div>
                    <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 'clamp(10px, 2vw, 13px)', marginTop: '6px', fontStyle: 'italic' }}>
                      Upper body strength improving
                    </div>
                  </div>
                )
              }
              const best = series[series.length - 1]
              return (
                <div style={{ background: '#0d1a0d', borderLeft: '3px solid #3fae52', padding: '16px', borderRadius: '10px', flex: '1 1 160px', minWidth: '140px', maxWidth: 'calc(50% - 8px)', wordBreak: 'break-word', overflow: 'hidden' }}>
                  <div style={{ color: 'white', fontSize: 'clamp(1.5rem, 4vw, 2.5rem)', fontWeight: 900, lineHeight: 1 }}>
                    {`${Math.round(Number(best.value))} lbs`}
                  </div>
                  <div style={{ color: 'rgba(63,174,82,0.8)', fontSize: 'clamp(9px, 2vw, 11px)', letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: '6px' }}>BENCH PRESS</div>
                  <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 'clamp(10px, 2vw, 13px)', marginTop: '6px', fontStyle: 'italic' }}>
                    Estimated 1-rep max
                  </div>
                </div>
              )
            })()}

            {/* Trap Bar Deadlift Callout */}
            {(() => {
              const series = trapSeries
              if (!series.length) return null
              if (series.length >= 2) {
                const first = series[0]
                const last = series[series.length - 1]
                const diff = Number(last.value) - Number(first.value)
                return (
                  <div style={{ background: '#0d1a0d', borderLeft: '3px solid #3fae52', padding: '16px', borderRadius: '10px', flex: '1 1 160px', minWidth: '140px', maxWidth: 'calc(50% - 8px)', wordBreak: 'break-word', overflow: 'hidden' }}>
                    <div style={{ color: '#3fae52', fontSize: 'clamp(1.5rem, 4vw, 2.5rem)', fontWeight: 900, lineHeight: 1 }}>
                      {`${diff >= 0 ? '+' : ''}${Math.round(diff)} lbs`}
                    </div>
                    <div style={{ color: 'rgba(63,174,82,0.8)', fontSize: 'clamp(9px, 2vw, 11px)', letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: '6px' }}>TRAP BAR DL</div>
                    <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 'clamp(10px, 2vw, 13px)', marginTop: '6px', fontStyle: 'italic' }}>
                      Posterior chain strength improving
                    </div>
                  </div>
                )
              }
              const best = series[series.length - 1]
              return (
                <div style={{ background: '#0d1a0d', borderLeft: '3px solid #3fae52', padding: '16px', borderRadius: '10px', flex: '1 1 160px', minWidth: '140px', maxWidth: 'calc(50% - 8px)', wordBreak: 'break-word', overflow: 'hidden' }}>
                  <div style={{ color: 'white', fontSize: 'clamp(1.5rem, 4vw, 2.5rem)', fontWeight: 900, lineHeight: 1 }}>
                    {`${Math.round(Number(best.value))} lbs`}
                  </div>
                  <div style={{ color: 'rgba(63,174,82,0.8)', fontSize: 'clamp(9px, 2vw, 11px)', letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: '6px' }}>TRAP BAR DL</div>
                  <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 'clamp(10px, 2vw, 13px)', marginTop: '6px', fontStyle: 'italic' }}>
                    Estimated 1-rep max
                  </div>
                </div>
              )
            })()}

            {/* Vertical Jump Callout */}
            {(() => {
              const series = verticalJumpSeries
              if (!series.length) return null
              if (series.length >= 2) {
                const first = series[0]
                const last = series[series.length - 1]
                const diff = Number(last.value) - Number(first.value)
                return (
                  <div style={{ background: '#0d1a0d', borderLeft: '3px solid #3fae52', padding: '16px', borderRadius: '10px', flex: '1 1 160px', minWidth: '140px', maxWidth: 'calc(50% - 8px)', wordBreak: 'break-word', overflow: 'hidden' }}>
                    <div style={{ color: '#3fae52', fontSize: 'clamp(1.5rem, 4vw, 2.5rem)', fontWeight: 900, lineHeight: 1 }}>
                      {`${diff >= 0 ? '+' : ''}${Math.round(diff)} cm`}
                    </div>
                    <div style={{ color: 'rgba(63,174,82,0.8)', fontSize: 'clamp(9px, 2vw, 11px)', letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: '6px' }}>VERTICAL JUMP</div>
                    <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 'clamp(10px, 2vw, 13px)', marginTop: '6px', fontStyle: 'italic' }}>
                      Explosive power improving
                    </div>
                  </div>
                )
              }
              const best = series[series.length - 1]
              return (
                <div style={{ background: '#0d1a0d', borderLeft: '3px solid #3fae52', padding: '16px', borderRadius: '10px', flex: '1 1 160px', minWidth: '140px', maxWidth: 'calc(50% - 8px)', wordBreak: 'break-word', overflow: 'hidden' }}>
                  <div style={{ color: 'white', fontSize: 'clamp(1.5rem, 4vw, 2.5rem)', fontWeight: 900, lineHeight: 1 }}>
                    {`${Math.round(Number(best.value))} cm`}
                  </div>
                  <div style={{ color: 'rgba(63,174,82,0.8)', fontSize: 'clamp(9px, 2vw, 11px)', letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: '6px' }}>VERTICAL JUMP</div>
                  <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 'clamp(10px, 2vw, 13px)', marginTop: '6px', fontStyle: 'italic' }}>
                    Current power benchmark
                  </div>
                </div>
              )
            })()}

            {/* Beep Test Callout */}
            {(() => {
              const series = beepSeries
              if (!series.length) return null
              if (series.length >= 2) {
                const first = series[0]
                const last = series[series.length - 1]
                const diff = Number(last.value) - Number(first.value)
                return (
                  <div style={{ background: '#0d1a0d', borderLeft: '3px solid #3fae52', padding: '16px', borderRadius: '10px', flex: '1 1 160px', minWidth: '140px', maxWidth: 'calc(50% - 8px)', wordBreak: 'break-word', overflow: 'hidden' }}>
                    <div style={{ color: '#3fae52', fontSize: 'clamp(1.5rem, 4vw, 2.5rem)', fontWeight: 900, lineHeight: 1 }}>
                      {`${diff >= 0 ? '+' : ''}${diff.toFixed(1)} levels`}
                    </div>
                    <div style={{ color: 'rgba(63,174,82,0.8)', fontSize: 'clamp(9px, 2vw, 11px)', letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: '6px' }}>BEEP TEST</div>
                    <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 'clamp(10px, 2vw, 13px)', marginTop: '6px', fontStyle: 'italic' }}>
                      Aerobic capacity improving
                    </div>
                  </div>
                )
              }
              const best = series[series.length - 1]
              return (
                <div style={{ background: '#0d1a0d', borderLeft: '3px solid #3fae52', padding: '16px', borderRadius: '10px', flex: '1 1 160px', minWidth: '140px', maxWidth: 'calc(50% - 8px)', wordBreak: 'break-word', overflow: 'hidden' }}>
                  <div style={{ color: 'white', fontSize: 'clamp(1.5rem, 4vw, 2.5rem)', fontWeight: 900, lineHeight: 1 }}>
                    {`Level ${Number(best.value).toFixed(1)}`}
                  </div>
                  <div style={{ color: 'rgba(63,174,82,0.8)', fontSize: 'clamp(9px, 2vw, 11px)', letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: '6px' }}>BEEP TEST</div>
                  <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 'clamp(10px, 2vw, 13px)', marginTop: '6px', fontStyle: 'italic' }}>
                    Current endurance benchmark
                  </div>
                </div>
              )
            })()}
          </div>

          {/* Block 3: Hockey Career Stats */}
          {profile?.sport === 'Hockey' && hockeyCareerRows.length > 0 && (
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(63,174,82,0.15)', borderRadius: '12px', padding: '16px' }}>
              <div style={{ color: 'rgba(63,174,82,0.8)', fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '10px' }}>Hockey Career</div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '520px' }}>
                  <thead>
                    <tr style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      {['Season', 'Team', 'League', 'GP', 'G', 'A', 'PTS', 'PIM'].map((h) => (
                        <th key={h} style={{ textAlign: 'left', padding: '8px 6px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {hockeyCareerRows.map((row, idx) => {
                      const isGoalie = row.position === 'G'
                      return (
                        <tr key={`${row.season}-${row.league}-${idx}`} style={{ background: idx === 0 ? 'rgba(63,174,82,0.05)' : 'transparent' }}>
                          <td style={{ padding: '8px 6px', borderBottom: '1px solid rgba(255,255,255,0.06)', borderLeft: idx === 0 ? '3px solid #3fae52' : 'none' }}>{row.season || '—'}</td>
                          <td style={{ padding: '8px 6px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                            {(() => {
                              const team = row.team_name || row.teamName
                              if (!team || team === '—') return row.league || ''
                              return team
                            })()}
                          </td>
                          <td style={{ padding: '8px 6px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>{row.league || '—'}</td>
                          <td style={{ padding: '8px 6px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>{row.games_played ?? '—'}</td>
                          {isGoalie ? (
                            <>
                              <td style={{ padding: '8px 6px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>{row.gaa != null ? Number(row.gaa).toFixed(2) : '—'}</td>
                              <td style={{ padding: '8px 6px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>{row.save_pct != null ? Number(row.save_pct).toFixed(3) : '—'}</td>
                            </>
                          ) : (
                            <>
                              <td style={{ padding: '8px 6px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>{row.goals ?? 0}</td>
                              <td style={{ padding: '8px 6px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>{row.assists ?? 0}</td>
                              <td style={{ padding: '8px 6px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>{row.points ?? 0}</td>
                              <td style={{ padding: '8px 6px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>{row.pim ?? 0}</td>
                            </>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {(() => {
                const rows = hockeyCareerRows.filter((r) => r.position !== 'G' && r.games_played > 0 && r.points != null)
                if (rows.length < 2) return null
                const withPpg = rows.map((r) => ({ ...r, ppg: (r.points || 0) / (r.games_played || 1) }))
                withPpg.sort((a, b) => (a.season || '').localeCompare(b.season || ''))
                const earliest = withPpg[0]
                const latest = withPpg[withPpg.length - 1]
                if (!earliest || !latest) return null
                const earliestPpg = earliest.ppg || 0
                const latestPpg = latest.ppg || 0
                if (latestPpg <= earliestPpg) return null
                const growth = ((latestPpg - earliestPpg) / (earliestPpg || 1)) * 100
                const firstName = (profile?.full_name || 'Athlete').split(' ')[0]
                return (
                  <div style={{ marginTop: '12px', color: '#3fae52', fontSize: '12px', fontStyle: 'italic' }}>
                    {firstName}'s points per game has grown from {earliestPpg.toFixed(2)} ({earliest.season || '—'}) to {latestPpg.toFixed(2)} ({latest.season || '—'}) — a {growth.toFixed(1)}% increase.
                  </div>
                )
              })()}
            </div>
          )}
        </div>

        {insights?.physical_standouts && (
          <div style={{ maxWidth: '900px', margin: '40px auto 40px auto', padding: '0 24px' }}>
            <div style={{
              fontSize: '11px',
              fontWeight: '700',
              letterSpacing: '0.15em',
              color: '#3fae52',
              textTransform: 'uppercase',
              marginBottom: '16px',
              paddingBottom: '8px',
              borderBottom: '1px solid rgba(63,174,82,0.2)'
            }}>
              Physical Standouts
            </div>
            <div style={{
              padding: '20px 24px',
              background: '#0d1a0d',
              border: '1px solid rgba(63,174,82,0.15)',
              borderLeft: '3px solid #3fae52',
              borderRadius: '12px',
            }}>
              <p style={{
                fontSize: '15px',
                color: 'rgba(255,255,255,0.85)',
                lineHeight: 1.8,
                margin: 0,
                fontWeight: '400'
              }}>
                {insights.physical_standouts}
              </p>
            </div>
          </div>
        )}

        {/* ── SECTION 4: PER CATEGORY BREAKDOWN ── */}
        <div style={{ marginTop: '48px' }}>
          <div style={{ color: '#3fae52', fontWeight: '800', fontSize: '13px', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '20px', borderBottom: '1px solid rgba(63,174,82,0.2)', paddingBottom: '8px' }}>
            Development Testing
          </div>
          {CATEGORIES.map((cat) => {
            const results = groupedResults[cat] || []
            const catTestTypes = [...new Set(results.map((r) => r.test_type))]
            return (
              <div key={cat} style={{ marginBottom: '40px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <h3 style={{ fontWeight: '800', fontSize: '18px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'white', margin: 0 }}>{cat}</h3>
                  <span style={{ fontSize: '22px', fontWeight: '900', color: getScoreColor(displayScores[cat]) }}>{displayScores[cat] ?? '—'}</span>
                </div>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', lineHeight: 1.6, marginBottom: '16px' }}>{CAT_DESCRIPTIONS[cat]}</p>
                {(() => {
                  const categoryKeyMap = {
                    'Speed': 'speed',
                    'Strength': 'strength',
                    'Power': 'power',
                    'Agility': 'agility',
                    'Endurance': 'endurance'
                  }
                  const insightKeyMap = {
                    'Speed': 'speed_insight',
                    'Strength': 'strength_insight',
                    'Power': 'power_insight',
                    'Agility': 'agility_insight',
                    'Endurance': 'endurance_insight'
                  }
                  const catLabel = cat[0]?.toUpperCase() + cat.slice(1)
                  const key = categoryKeyMap[catLabel]
                  const insightKey = insightKeyMap[catLabel]
                  const athleteScore = compScore?.[key + '_score']
                  const peerAverage = peerAvg?.[key]
                  const aiInsight = insights?.[insightKey]
                  const showAiInsight = catTestTypes.length > 1 && aiInsight

                  if (!athleteScore || !peerAverage) return null

                  const ratio = athleteScore / peerAverage
                  const firstName = profile?.full_name?.split(' ')[0] || 'This athlete'
                  const ageCategory = profile?.age_category || ''
                  const sport = profile?.sport || 'athletes'

                  let rankText, colorStyle
                  if (ratio >= 1.4) {
                    rankText = `${firstName} ranks in the top 10% for ${cat.toLowerCase()} among ${ageCategory} ${sport} athletes we have tested.` 
                    colorStyle = '#3fae52'
                  } else if (ratio >= 1.2) {
                    rankText = `${firstName} ranks in the top 25% for ${cat.toLowerCase()} among ${ageCategory} ${sport} athletes we have tested.` 
                    colorStyle = '#3fae52'
                  } else if (ratio >= 1.0) {
                    rankText = `${firstName} is above average for ${cat.toLowerCase()} among ${ageCategory} ${sport} athletes we have tested.` 
                    colorStyle = '#f5a623'
                  } else if (ratio >= 0.85) {
                    rankText = `${cat} is an active development priority for ${firstName} this season.` 
                    colorStyle = '#f5a623'
                  } else {
                    rankText = `${cat} is a key development focus for ${firstName} — we are actively working on this.` 
                    colorStyle = '#e05c2a'
                  }

                  return (
                    <div style={{ marginBottom: '16px' }}>
                      <div style={{
                        padding: '10px 14px',
                        background: 'rgba(63,174,82,0.05)',
                        borderLeft: `3px solid ${colorStyle}`,
                        borderRadius: '4px',
                        marginBottom: showAiInsight ? '8px' : '0'
                      }}>
                        <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.75)', fontStyle: 'italic' }}>
                          {rankText}
                        </span>
                      </div>
                      {showAiInsight && (
                        <div style={{
                          padding: '10px 14px',
                          background: 'rgba(255,255,255,0.03)',
                          borderLeft: '3px solid rgba(255,255,255,0.15)',
                          borderRadius: '4px',
                        }}>
                          <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.65)', lineHeight: 1.7 }}>
                            {aiInsight}
                          </span>
                        </div>
                      )}
                    </div>
                  )
                })()}
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
                      <div
                        key={tt}
                        style={{
                          background: '#0d1a0e',
                          border: '1px solid rgba(63,174,82,0.15)',
                          borderRadius: '12px',
                          padding: '16px',
                        }}
                      >
                        <div style={{ color: '#3fae52', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>
                          {{
                            squat: 'Squat *',
                            bench_press: 'Bench Press *',
                            trap_bar_deadlift: 'Trap Bar Deadlift *',
                          }[tt] || tt.replaceAll('_', ' ')}
                        </div>
                        <div style={{ fontSize: '22px', fontWeight: '900', color: 'white', marginBottom: '12px' }}>
                          {pb ? formatVal(tt, pb.value) : '—'}
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
                        {(() => {
                          const testInsightMap = {
                            'squat': 'squat_insight',
                            'bench_press': 'bench_press_insight',
                            'trap_bar_deadlift': 'trap_bar_insight',
                            'pull_ups': 'pull_ups_insight',
                            'push_ups': 'push_ups_insight',
                            'vertical_jump': 'vertical_jump_insight',
                            'broad_jump': 'broad_jump_insight',
                            'mb_chest_pass': 'mb_chest_pass_insight',
                            '10m_sprint': 'speed_insight',
                            'pro_agility_shuttle': 'agility_insight',
                            'beep_test': 'endurance_insight',
                          }
                          const insightKey = testInsightMap[tt]
                          const insightText = insights?.[insightKey]
                          if (!insightText) return null
                          return (
                            <div style={{
                              marginTop: '12px',
                              paddingTop: '10px',
                              borderTop: '1px solid rgba(63,174,82,0.1)',
                              fontSize: '12px',
                              color: 'rgba(255,255,255,0.55)',
                              lineHeight: 1.6,
                              fontStyle: 'italic'
                            }}>
                              {insightText}
                            </div>
                          )
                        })()}
                      </div>
                    )
                  })}
                </div>
                {cat === 'strength' && (
                  <div
                    style={{
                      marginTop: '16px',
                      padding: '12px 16px',
                      background: 'rgba(255,255,255,0.03)',
                      borderRadius: '8px',
                      border: '1px solid rgba(255,255,255,0.06)',
                      color: 'rgba(255,255,255,0.35)',
                      fontSize: '11px',
                      lineHeight: '1.5',
                      fontStyle: 'italic',
                    }}
                  >
                    * Squat, Bench Press, and Trap Bar Deadlift values represent an estimated one-repetition maximum (1RM), calculated from the load and repetitions performed during testing using a validated predictive formula. Actual 1RM may vary.
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* ── SECTION 5: PFA PERFORMANCE SCORES ── */}
        <div style={{ marginTop: '48px', marginBottom: '48px' }}>
          <div style={{ background: 'rgba(63,174,82,0.08)', borderBottom: '1px solid rgba(63,174,82,0.25)', padding: '12px 0', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#3fae52', fontWeight: '800', fontSize: '13px', letterSpacing: '0.15em', textTransform: 'uppercase' }}>PFA Performance Scores</span>
            <div />
          </div>

          {compScore && (
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.7, marginBottom: '24px', maxWidth: '680px' }}>
              {`These scores reflect ${firstName}'s physical development relative to other ${profile?.gender} ${profile?.age_category} athletes tested at Peak Fitness Athletics. Each score is calculated from standardized testing and normalized against ${pronoun} peer group — a score of 50 represents the peer average. ${firstName}'s overall score of ${compScore?.overall_score} places ${pronoun} ${compScore?.overall_score > 50 ? 'above' : 'below'} the average for ${pronoun} age group and level.`}
            </p>
          )}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: '12px',
              width: '100%',
            }}
          >
            <div style={{ background: 'linear-gradient(135deg, rgba(63,174,82,0.18), rgba(10,15,10,0.9))', border: '1px solid rgba(63,174,82,0.45)', borderRadius: '14px', padding: '18px', textAlign: 'center', boxShadow: '0 12px 30px rgba(0,0,0,0.4)' }}>
              <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: '10px' }}>Overall</div>
              <div style={{ fontSize: '56px', fontWeight: '900', color: getScoreColor(displayScores.overall), lineHeight: 1 }}>{displayScores.overall ?? '—'}</div>
              <div style={{ marginTop: '12px', height: '5px', background: 'rgba(255,255,255,0.12)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${displayScores.overall ?? 0}%`, background: getScoreColor(displayScores.overall), borderRadius: '3px' }} />
              </div>
            </div>
            {CATEGORIES.map((cat) => {
              const score = displayScores[cat]
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

          {(() => {
            if (insights?.scores_summary) {
              return (
                <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.7, marginTop: '16px', padding: '14px 16px', background: 'rgba(255,255,255,0.03)', borderLeft: '3px solid rgba(63,174,82,0.3)', borderRadius: '4px' }}>
                  {insights.scores_summary}
                </div>
              )
            }

            if (!compScore) return null
            const categories = {
              Speed: compScore.speed_score,
              Strength: compScore.strength_score,
              Power: compScore.power_score,
              Agility: compScore.agility_score,
              Endurance: compScore.endurance_score,
            }
            const entries = Object.entries(categories).filter(([, v]) => v != null)
            if (!entries.length) return null
            const sorted = entries.sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
            const top = sorted[0]
            const bottom = sorted[sorted.length - 1]
            return (
              <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.7, marginTop: '16px', padding: '14px 16px', background: 'rgba(255,255,255,0.03)', borderLeft: '3px solid rgba(63,174,82,0.3)', borderRadius: '4px' }}>
                {`${firstName}'s strongest category is ${top[0]} with a score of ${top[1]}, standing out among ${profile?.gender} ${profile?.age_category} peers. ${bottom[0]} is the current development focus with a score of ${bottom[1]} — an active priority in ${pronoun} training program.`}
              </div>
            )
          })()}
        </div>

        {/* ── SECTION 6: INSIGHTS ── */}
        {insights?.what_to_watch && (
          <div style={{ maxWidth: '900px', margin: '0 auto 48px auto', padding: '0 24px' }}>
            <div style={{
              fontSize: '11px',
              fontWeight: '700',
              letterSpacing: '0.15em',
              color: '#3fae52',
              textTransform: 'uppercase',
              marginBottom: '16px',
              paddingBottom: '8px',
              borderBottom: '1px solid rgba(63,174,82,0.2)'
            }}>
              What To Watch
            </div>
            <div style={{
              padding: '24px 28px',
              background: '#0d1a0d',
              border: '1px solid rgba(63,174,82,0.15)',
              borderLeft: '4px solid #3fae52',
              borderRadius: '12px',
            }}>
              <p style={{
                fontSize: '15px',
                color: 'rgba(255,255,255,0.88)',
                lineHeight: 1.9,
                margin: 0,
                fontWeight: '400'
              }}>
                {insights.what_to_watch}
              </p>
            </div>
          </div>
        )}

        {insights?.next_steps && (
          <div style={{ maxWidth: '900px', margin: '0 auto 48px auto', padding: '0 24px' }}>
            <div style={{
              fontSize: '11px',
              fontWeight: '700',
              letterSpacing: '0.15em',
              color: '#3fae52',
              textTransform: 'uppercase',
              marginBottom: '16px',
              paddingBottom: '8px',
              borderBottom: '1px solid rgba(63,174,82,0.2)'
            }}>
              Next Steps
            </div>
            <div style={{
              padding: '20px 24px',
              background: '#0d1a0d',
              border: '1px solid rgba(63,174,82,0.15)',
              borderLeft: '3px solid rgba(255,255,255,0.15)',
              borderRadius: '12px',
            }}>
              <p style={{
                fontSize: '14px',
                color: 'rgba(255,255,255,0.7)',
                lineHeight: 1.8,
                margin: 0
              }}>
                {insights.next_steps}
              </p>
            </div>
          </div>
        )}

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
