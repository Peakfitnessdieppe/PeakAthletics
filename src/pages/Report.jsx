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
import { BENCHMARKS, LEVEL_LADDERS, TIER_DESCRIPTIONS, LOWER_IS_BETTER_TESTS } from '../constants/levelReadinessBenchmarks'

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

const TIER_COLORS = {
  'Elite Trajectory': '#a855f7',
  'Advanced': '#3fae52',
  'On Track': '#06b6d4',
  'Developing': 'rgba(255,255,255,0.4)',
}

const STRENGTH_LOAD_TESTS = ['squat', 'bench_press', 'trap_bar_deadlift']
const LOWER_IS_BETTER = ['10m_sprint', '30m_sprint', 'pro_agility_shuttle']
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
  '30m_sprint': { min: 3.5, max: 6.0, higherIsBetter: false },
  triple_jump: { min: 4.0, max: 8.0, higherIsBetter: true },
  plank: { min: 0, max: 300, higherIsBetter: true },
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
  if (lbTests.includes(testType)) return `${Math.round(parseFloat(value))} lbs`
  if (testType === 'broad_jump') return `${Number(value).toFixed(2)} m`
  if (['10m_sprint', '30m_sprint', 'pro_agility_shuttle'].includes(testType)) return `${Number(value).toFixed(3)} s`
  if (['vertical_jump', 'ncmj'].includes(testType)) return `${Number(value).toFixed(1)} in`
  if (testType === 'beep_test') return `Level ${Number(value).toFixed(2)}`
  if (['pull_ups', 'push_ups'].includes(testType)) return `${Math.round(value)} reps`
  if (testType === '30m_sprint') return `${Number(value).toFixed(2)}s`
  if (testType === 'triple_jump') return `${Number(value).toFixed(2)}m`
  if (testType === 'plank') return `${Math.round(value)}s`
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
  const [avatarUrl, setAvatarUrl] = useState(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef(null)
  const [lightMode, setLightMode] = useState(false)

  const tooltipStyle = {
    position: 'relative',
    display: 'inline-flex',
  }
  const tooltipTextStyle = {
    visibility: 'hidden',
    opacity: 0,
    position: 'absolute',
    bottom: '130%',
    left: '50%',
    transform: 'translateX(-50%)',
    background: '#1a2e1a',
    border: '1px solid rgba(255,255,255,0.12)',
    color: 'rgba(255,255,255,0.85)',
    fontSize: '11px',
    lineHeight: '1.5',
    padding: '6px 10px',
    borderRadius: '6px',
    whiteSpace: 'nowrap',
    zIndex: 50,
    pointerEvents: 'none',
    transition: 'opacity 0.15s ease',
  }

  const CHIP_TOOLTIPS = {
    male: {
      '10m_sprint': {
        'U14': 'HNB U14 Gold standard · Source: Hockey New Brunswick',
        'U15': 'HNB U15 Gold standard · Source: Hockey New Brunswick',
        'U16': 'HNB U16 Gold standard · Source: Hockey New Brunswick',
        'Junior': 'Junior A target · Source: Hockey Canada',
        'CHL': 'Canadian Hockey League standard · Source: Hockey Canada',
        'NHL': 'NHL combine average · Source: NHL combine data',
      },
      'pro_agility_shuttle': {
        'U14': 'HNB U14 Gold standard · Source: Hockey New Brunswick',
        'U15': 'HNB U15 Gold standard · Source: Hockey New Brunswick',
        'U16': 'HNB U16 Gold standard · Source: Hockey New Brunswick',
        'Junior': 'Junior A target · Source: Hockey Canada',
        'CHL': 'Canadian Hockey League standard · Source: NHL combine data',
        'NHL': 'NHL combine average · Source: NHL combine data',
      },
      'vertical_jump': {
        'U14': 'HNB U14 Gold standard · Source: Hockey New Brunswick',
        'U15': 'HNB U15 Gold standard · Source: Hockey New Brunswick',
        'U16': 'HNB U16 Gold standard · Source: Hockey New Brunswick',
        'Junior': 'Junior A target · Source: Hockey Canada',
        'CHL': 'CHL-age average · Source: Research estimate',
        'NHL': 'NHL combine average · Source: Research estimate',
      },
      'broad_jump': {
        'Junior': 'Junior A target · Source: Hockey Canada',
        'CHL': 'CHL-age average · Source: Research estimate',
        'NHL': 'NHL combine average · Source: Research estimate',
      },
      'pull_ups': {
        'U14': 'HNB U14 Gold standard · Source: Hockey New Brunswick',
        'U15': 'HNB U15 Gold standard · Source: Hockey New Brunswick',
        'U16': 'HNB U16 Gold standard · Source: Hockey New Brunswick',
        'Junior': 'Junior A target · Source: Hockey Canada',
        'CHL': 'CHL-age average · Source: Research estimate',
        'NHL': 'NHL combine average · Source: Research estimate',
      },
      'beep_test': {
        'U14': 'HNB U14 Gold standard · Source: Hockey New Brunswick',
        'U15': 'HNB U15 Gold standard · Source: Hockey New Brunswick',
        'U16': 'HNB U16 Gold standard · Source: Hockey New Brunswick',
        'Junior': 'Junior A target · Source: Hockey Canada',
      },
      'squat': {
        'U15': 'Expected strength ratio for U15 athletes · Source: PFA working target',
        'U18': 'Expected strength ratio for U18 athletes · Source: PFA working target',
        'CHL': 'Expected strength ratio for CHL-level athletes · Source: PFA working target',
        'Pro': 'Expected strength ratio for professional athletes · Source: Research estimate',
      },
      'bench_press': {
        'U15': 'Expected strength ratio for U15 athletes · Source: PFA working target',
        'U18': 'Expected strength ratio for U18 athletes · Source: PFA working target',
        'CHL': 'Expected strength ratio for CHL-level athletes · Source: PFA working target',
        'Pro': 'Expected strength ratio for professional athletes · Source: Research estimate',
      },
      'trap_bar_deadlift': {
        'U14': 'Expected strength ratio for U14 athletes · Source: PFA working target',
        'U16': 'Expected strength ratio for U16 athletes · Source: PFA working target',
        'U18': 'Expected strength ratio for U18 athletes · Source: PFA working target',
        'CHL': 'Expected strength ratio for CHL-level athletes · Source: PFA working target',
        'Pro': 'Expected strength ratio for professional athletes · Source: Research estimate',
      },
    },
    female: {
      '10m_sprint': {
        'U14': 'HNB U14 Gold standard · Source: Hockey New Brunswick',
        'U16': 'HNB U16 Gold standard · Source: Hockey New Brunswick',
        'Junior': 'FU18 national target · Source: Hockey Canada',
      },
      'pro_agility_shuttle': {
        'U14': 'HNB U14 Gold standard · Source: Hockey New Brunswick',
        'U16': 'HNB U16 Gold standard · Source: Hockey New Brunswick',
        'Junior': 'FU18 national target · Source: Hockey Canada',
      },
      'vertical_jump': {
        'U14': 'HNB U14 Gold standard · Source: Hockey New Brunswick',
        'U16': 'HNB U16 Gold standard · Source: Hockey New Brunswick',
        'Junior': 'FU18 national target · Source: Hockey Canada',
        'IIHF': 'IIHF elite average · Source: Research estimate',
        'Olympic': 'Olympic/PWHL average · Source: Research estimate',
      },
      'broad_jump': {
        'Junior': 'FU18 national target · Source: Hockey Canada',
        'IIHF': 'IIHF elite average · Source: Research estimate',
        'Olympic': 'Olympic/PWHL average · Source: Research estimate',
      },
      'pull_ups': {
        'U14': 'HNB U14 Gold standard · Source: Hockey New Brunswick',
        'U16': 'HNB U16 Gold standard · Source: Hockey New Brunswick',
        'Junior': 'FU18 national target · Source: Hockey Canada',
      },
      'beep_test': {
        'U14': 'HNB U14 Gold standard · Source: Hockey New Brunswick',
        'U16': 'HNB U16 Gold standard · Source: Hockey New Brunswick',
        'Junior': 'FU18 national target · Source: Hockey Canada',
      },
      'squat': {
        'U14': 'Expected strength ratio for U14 athletes · Source: PFA working target',
        'U16': 'Expected strength ratio for U16 athletes · Source: PFA working target',
        'U18': 'Expected strength ratio for U18 athletes · Source: PFA working target',
        'Elite': 'Expected strength ratio for elite athletes · Source: Research estimate',
      },
      'bench_press': {
        'U14': 'Expected strength ratio for U14 athletes · Source: PFA working target',
        'U16': 'Expected strength ratio for U16 athletes · Source: PFA working target',
        'U18': 'Expected strength ratio for U18 athletes · Source: PFA working target',
        'Elite': 'Expected strength ratio for elite athletes · Source: Research estimate',
      },
      'trap_bar_deadlift': {
        'U14': 'Expected strength ratio for U14 athletes · Source: PFA working target',
        'U16': 'Expected strength ratio for U16 athletes · Source: PFA working target',
        'U18': 'Expected strength ratio for U18 athletes · Source: PFA working target',
        'Elite': 'Expected strength ratio for elite athletes · Source: Research estimate',
      },
    },
  }

  const uploadPhoto = async (file) => {
    if (!file || !profile?.id) return
    setUploading(true)
    try {
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', profile.id)
        .single()
      const currentUrl = existingProfile?.avatar_url
      if (currentUrl) {
        try {
          const url = new URL(currentUrl)
          const segments = url.pathname.split('/')
          const bucketIndex = segments.findIndex((p) => decodeURIComponent(p) === 'Athlete Photos')
          if (bucketIndex >= 0) {
            const oldPath = decodeURIComponent(segments.slice(bucketIndex + 1).join('/'))
            await supabase.storage.from('Athlete Photos').remove([oldPath])
          }
        } catch (err) {
          console.error('Parse old avatar URL failed', err)
        }
      }
      const ext = file.name.split('.').pop()
      const path = `${profile.id}_${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('Athlete Photos')
        .upload(path, file, { upsert: true })
      if (uploadError) throw uploadError
      const { data: urlData } = supabase.storage.from('Athlete Photos').getPublicUrl(path)
      const newUrl = `${urlData.publicUrl}?t=${Date.now()}`
      await supabase
        .from('profiles')
        .update({ avatar_url: urlData.publicUrl, updated_at: new Date().toISOString() })
        .eq('id', profile.id)
      setAvatarUrl(newUrl)
    } catch (err) {
      console.error('Upload failed', err)
    }
    setUploading(false)
  }

  const onFileChange = (e) => {
    const file = e.target.files?.[0]
    if (file) uploadPhoto(file)
  }

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

        setAllTestResults(data?.results || [])

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

  useEffect(() => {
    if (reportData?.profile?.avatar_url && !avatarUrl) setAvatarUrl(reportData.profile.avatar_url)
  }, [reportData?.profile?.avatar_url])

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
  const strengthSeriesSquat = deduplicateByBestPerDay(
    buildStrengthSeries('squat').map((r) => ({ ...r, value: calcE1RM(r.load_value, r.reps) })),
    'squat'
  )
  const strengthSeriesTBDL = deduplicateByBestPerDay(
    buildStrengthSeries('trap_bar_deadlift').map((r) => ({ ...r, value: calcE1RM(r.load_value, r.reps) })),
    'trap_bar_deadlift'
  )
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
      <div style={{ minHeight: '100vh', background: lightMode ? '#f5f7f5' : '#0a0f0a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: lightMode ? '#111' : 'white' }}>
        No athlete selected.
      </div>
    )
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: lightMode ? '#f5f7f5' : '#0a0f0a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: lightMode ? '#111' : 'white', flexDirection: 'column', gap: '16px' }}>
        <div style={{ width: '40px', height: '40px', border: '4px solid #3fae52', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <span style={{ color: lightMode ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)' }}>Loading report...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', background: lightMode ? '#f5f7f5' : '#0a0f0a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f87171', padding: '32px' }}>
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
    <div style={{ background: lightMode ? '#f5f7f5' : '#050705', minHeight: '100vh', color: lightMode ? '#111' : 'white', fontFamily: 'sans-serif', overflowX: 'hidden', width: '100%' }}>

      {/* BACK BUTTON + LIGHT MODE TOGGLE */}
      <div style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button
          onClick={() => navigate(-1)}
          style={{ background: lightMode ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)', border: '1px solid rgba(63,174,82,0.3)', borderRadius: '8px', color: '#3fae52', padding: '8px 16px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}
        >
          ← Back
        </button>
        <button
          onClick={() => setLightMode(lm => !lm)}
          style={{ background: lightMode ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)', border: `1px solid ${lightMode ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.15)'}`, borderRadius: '8px', color: lightMode ? '#333' : '#ccc', padding: '8px 14px', cursor: 'pointer', fontSize: '12px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          {lightMode ? '🌙 Dark Mode' : '☀️ Light Mode'}
        </button>
      </div>

      {/* ── SECTION 1: ATHLETE HERO ── */}
      <div
        style={{
          width: '100%',
          minHeight: '220px',
          backgroundColor: lightMode ? '#f5f7f5' : '#050705',
          position: 'relative',
          overflow: 'hidden',
          overflowX: 'hidden',
          padding: isMobile ? '24px 16px 0 16px' : '40px 24px 0 24px',
        }}
      >
        <div style={{ maxWidth: '100%', margin: '0 auto', padding: isMobile ? '24px 16px 0' : '40px 48px 0' }}>
          <div style={{
            display: 'flex',
            flexDirection: window.innerWidth < 768 ? 'column' : 'row',
            gap: '32px',
            alignItems: window.innerWidth < 768 ? 'flex-start' : 'center'
          }}>

            <div style={{
              width: isMobile ? '100%' : '280px',
              height: isMobile ? '240px' : '320px',
              borderRadius: '8px',
              overflow: 'hidden',
              flexShrink: 0,
              position: 'relative',
            }}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={onFileChange}
              />
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={profile?.full_name}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    objectPosition: 'top',
                    display: 'block',
                  }}
                />
              ) : (
                <div style={{
                  width: '100%',
                  height: '100%',
                  background: 'rgba(63,174,82,0.06)',
                  border: '1px solid rgba(63,174,82,0.15)',
                  borderRadius: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '12px',
                }}>
                  <div style={{
                    width: '72px',
                    height: '72px',
                    borderRadius: '50%',
                    border: '2px dashed rgba(63,174,82,0.4)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#3fae52',
                    fontSize: '24px',
                    fontWeight: 800,
                  }}>
                    {(profile?.full_name || 'A').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      fileInputRef.current?.click()
                    }}
                    style={{
                      background: 'rgba(63,174,82,0.9)',
                      border: 'none',
                      borderRadius: '50%',
                      width: '40px',
                      height: '40px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                      <path d="M12 15.2A3.2 3.2 0 1 1 12 8.8a3.2 3.2 0 0 1 0 6.4zm7-11.2h-1.8l-1.4-2H8.2L6.8 4H5a3 3 0 0 0-3 3v11a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3z" />
                    </svg>
                  </button>
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>
                    {uploading ? 'Uploading...' : 'Tap to add photo'}
                  </div>
                </div>
              )}
              {avatarUrl && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    fileInputRef.current?.click()
                  }}
                  style={{
                    position: 'absolute',
                    bottom: '10px',
                    right: '10px',
                    background: 'rgba(63,174,82,0.9)',
                    border: 'none',
                    borderRadius: '50%',
                    width: '36px',
                    height: '36px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                    <path d="M12 15.2A3.2 3.2 0 1 1 12 8.8a3.2 3.2 0 0 1 0 6.4zm7-11.2h-1.8l-1.4-2H8.2L6.8 4H5a3 3 0 0 0-3 3v11a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3z" />
                  </svg>
                </button>
              )}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
                <img
                  src={PFA_LOGO}
                  alt="PFA"
                  style={{
                    height: isMobile ? '160px' : '220px',
                    width: 'auto',
                    flexShrink: 0,
                    filter: 'drop-shadow(0 0 12px rgba(63,174,82,0.5))'
                  }}
                />
                <div>
                  <div style={{
                    fontSize: isMobile ? '16px' : '22px',
                    fontWeight: '800',
                    letterSpacing: '0.08em',
                    color: '#3fae52',
                    textTransform: 'uppercase',
                    marginBottom: '6px',
                    lineHeight: 1.1
                  }}>
                    Peak Fitness Athletics
                  </div>
                  <div style={{
                    fontSize: isMobile ? '12px' : '15px',
                    fontWeight: '500',
                    letterSpacing: '0.06em',
                    color: lightMode ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)',
                    lineHeight: 1.4,
                    textTransform: 'uppercase'
                  }}>
                    Performance & Development Report
                  </div>
                </div>
              </div>

              <h1 style={{
                fontSize: 'clamp(2rem, 5vw, 3.5rem)',
                fontWeight: '900',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: lightMode ? '#0a1a0a' : 'white',
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
                {(profile?.pfa_teams?.name || profile?.team_name) && (
                  <span style={{ color: '#9ce6a8', fontWeight: 700, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    {profile?.pfa_teams?.name || profile?.team_name}
                  </span>
                )}
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
                    <div style={{ color: lightMode ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)', fontSize: '10px', letterSpacing: '0.14em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</div>
                    <div style={{ color: lightMode ? '#111' : 'white', fontWeight: 800, fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.value}</div>
                    {idx !== arr.length - 1 && !isMobile && <div style={{ flex: 1, height: '1px', background: lightMode ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)' }} />}
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
          color: lightMode ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.8)',
          fontStyle: 'italic',
          lineHeight: 1.7,
          borderLeft: '3px solid #3fae52',
          paddingLeft: '16px',
          background: lightMode ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.03)',
          borderRadius: '6px'
        }}>
          {insights.this_season}
        </div>
      )}

      <div style={{ maxWidth: '100%', margin: '0 auto', padding: isMobile ? '0 16px' : '0 48px', width: '100%' }}>

        <div style={{ maxWidth: '100%', margin: '0 auto', padding: isMobile ? '0 0 64px' : '0 0 80px', width: '100%' }}>

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
                ? 'Sprint speed improving — trending in the right direction'
                : regressed
                  ? 'Sprint speed has slowed since last test — flagged for attention'
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
              let label = 'Broad Jump'
              let subtitleImprove = 'Broad jump improvement at Peak Fitness'
              let subtitlePB = 'Current power benchmark'
              series = powerSeriesBJ.length ? powerSeriesBJ : powerSeriesVJ
              if (!powerSeriesBJ.length && powerSeriesVJ.length) {
                label = 'Vertical Jump'
                subtitleImprove = 'Vertical jump improvement at Peak Fitness'
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
                  ? `${label} declined since last test — flagged for attention`
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
                const improved = improvement > 0
                const regressed = improvement < 0
                const displayVal = improved
                  ? `${Math.abs(improvement).toFixed(2)}s faster`
                  : regressed
                    ? `${Math.abs(improvement).toFixed(2)}s slower`
                    : 'No change'
                const numberColor = regressed ? '#f59e0b' : improved ? '#3fae52' : 'white'
                const subtitle = improved
                  ? 'Change of direction improving'
                  : regressed
                    ? 'Agility has declined since last test — flagged for attention'
                    : 'No change since last test'
                return (
                  <div style={{ background: '#0d1a0d', borderLeft: '3px solid #3fae52', padding: '16px', borderRadius: '10px', flex: '1 1 160px', minWidth: '140px', maxWidth: 'calc(50% - 8px)', wordBreak: 'break-word', overflow: 'hidden' }}>
                    <div style={{ color: numberColor, fontSize: 'clamp(1.2rem, 3.5vw, 2rem)', fontWeight: 900, lineHeight: 1 }}>
                      {displayVal}
                    </div>
                    <div style={{ color: 'rgba(63,174,82,0.8)', fontSize: 'clamp(9px, 2vw, 11px)', letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: '6px' }}>AGILITY</div>
                    <div style={{ color: regressed ? '#f59e0b' : 'rgba(255,255,255,0.65)', fontSize: 'clamp(10px, 2vw, 13px)', marginTop: '6px', fontStyle: 'italic' }}>
                      {subtitle}
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
                    <div style={{ color: diff < 0 ? '#f59e0b' : 'rgba(255,255,255,0.65)', fontSize: 'clamp(10px, 2vw, 13px)', marginTop: '6px', fontStyle: 'italic' }}>
                      {diff > 0 ? 'Upper body strength improving' : diff < 0 ? 'Bench press declined since last test — flagged for attention' : 'No change since last test'}
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
                    <div style={{ color: diff < 0 ? '#f59e0b' : 'rgba(255,255,255,0.65)', fontSize: 'clamp(10px, 2vw, 13px)', marginTop: '6px', fontStyle: 'italic' }}>
                      {diff > 0 ? 'Posterior chain strength improving' : diff < 0 ? 'Trap bar declined since last test — flagged for attention' : 'No change since last test'}
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
                const improved = diff > 0
                const regressed = diff < 0
                const displayVal = improved
                  ? `+${Math.round(diff)} cm`
                  : regressed
                    ? `${Math.round(diff)} cm`
                    : 'No change'
                const numberColor = regressed ? '#f59e0b' : improved ? '#3fae52' : 'white'
                const subtitle = improved
                  ? 'Explosive power trending up'
                  : regressed
                    ? 'Vertical jump declined since last test — flagged for attention'
                    : 'No change since last test'
                return (
                  <div style={{ background: '#0d1a0d', borderLeft: '3px solid #3fae52', padding: '16px', borderRadius: '10px', flex: '1 1 160px', minWidth: '140px', maxWidth: 'calc(50% - 8px)', wordBreak: 'break-word', overflow: 'hidden' }}>
                    <div style={{ color: numberColor, fontSize: 'clamp(1.5rem, 4vw, 2.5rem)', fontWeight: 900, lineHeight: 1 }}>
                      {displayVal}
                    </div>
                    <div style={{ color: 'rgba(63,174,82,0.8)', fontSize: 'clamp(9px, 2vw, 11px)', letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: '6px' }}>VERTICAL JUMP</div>
                    <div style={{ color: regressed ? '#f59e0b' : 'rgba(255,255,255,0.65)', fontSize: 'clamp(10px, 2vw, 13px)', marginTop: '6px', fontStyle: 'italic' }}>
                      {subtitle}
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
                const improved = diff > 0
                const regressed = diff < 0
                const displayVal = improved
                  ? `+${diff.toFixed(1)} levels`
                  : regressed
                    ? `${diff.toFixed(1)} levels`
                    : 'No change'
                const numberColor = regressed ? '#f59e0b' : improved ? '#3fae52' : 'white'
                const subtitle = improved
                  ? 'Aerobic capacity improving'
                  : regressed
                    ? 'Endurance declined since last test — flagged for attention'
                    : 'No change since last test'
                return (
                  <div style={{ background: '#0d1a0d', borderLeft: '3px solid #3fae52', padding: '16px', borderRadius: '10px', flex: '1 1 160px', minWidth: '140px', maxWidth: 'calc(50% - 8px)', wordBreak: 'break-word', overflow: 'hidden' }}>
                    <div style={{ color: numberColor, fontSize: 'clamp(1.5rem, 4vw, 2.5rem)', fontWeight: 900, lineHeight: 1 }}>
                      {displayVal}
                    </div>
                    <div style={{ color: 'rgba(63,174,82,0.8)', fontSize: 'clamp(9px, 2vw, 11px)', letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: '6px' }}>BEEP TEST</div>
                    <div style={{ color: regressed ? '#f59e0b' : 'rgba(255,255,255,0.65)', fontSize: 'clamp(10px, 2vw, 13px)', marginTop: '6px', fontStyle: 'italic' }}>
                      {subtitle}
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
                    <tr style={{ color: lightMode ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.7)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
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
          <div style={{
            maxWidth: '1100px',
            margin: '32px auto 40px auto',
            padding: isMobile ? '0 16px' : '0 24px',
            fontSize: '1.05rem',
            color: lightMode ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.8)',
            fontStyle: 'italic',
            lineHeight: 1.7,
            borderLeft: '3px solid #3fae52',
            paddingLeft: '16px'
          }}>
            {insights.physical_standouts}
          </div>
        )}

        {/* ── SECTION 4: PER CATEGORY BREAKDOWN ── */}
        <div style={{ marginTop: '48px' }}>
          <div style={{ color: '#3fae52', fontWeight: '800', fontSize: '13px', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '20px', borderBottom: '1px solid rgba(63,174,82,0.2)', paddingBottom: '8px' }}>
            Development Testing
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '24px', marginTop: '8px' }}>
            <div style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '0.12em', textTransform: 'uppercase', color: lightMode ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.25)', marginRight: '4px' }}>Benchmarks:</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ padding: '2px 7px', borderRadius: '999px', fontSize: '9px', fontWeight: '700', background: 'rgba(63,174,82,0.12)', border: '1px solid rgba(63,174,82,0.25)', color: '#3fae52' }}>✓</span>
              <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)' }}>cleared</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ padding: '2px 7px', borderRadius: '999px', fontSize: '9px', fontWeight: '700', background: 'rgba(168,85,247,0.15)', border: '1px solid #a855f7', color: '#a855f7' }}>YOU</span>
              <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)' }}>you are here</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ padding: '2px 7px', borderRadius: '999px', fontSize: '9px', fontWeight: '700', background: lightMode ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.04)', border: '1px solid #3fae52', color: '#3fae52' }}>→</span>
              <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)' }}>next target</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ padding: '2px 7px', borderRadius: '999px', fontSize: '9px', fontWeight: '700', background: lightMode ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.03)', border: `1px solid ${lightMode ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.08)'}`, color: lightMode ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.2)' }}>···</span>
              <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)' }}>future milestone</span>
            </div>
          </div>
          {CATEGORIES.map((cat) => {
            const results = groupedResults[cat] || []
            const catTestTypes = [...new Set(results.map((r) => r.test_type))]
            return (
              <div key={cat} style={{ marginBottom: '40px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <h3 style={{ fontWeight: '800', fontSize: '18px', textTransform: 'uppercase', letterSpacing: '0.08em', color: lightMode ? '#111' : 'white', margin: 0 }}>{cat}</h3>
                  <span style={{ fontSize: '22px', fontWeight: '900', color: getScoreColor(displayScores[cat]) }}>{displayScores[cat] ?? '—'}</span>
                </div>
                <p style={{ color: lightMode ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)', fontSize: '13px', lineHeight: 1.6, marginBottom: '16px' }}>{CAT_DESCRIPTIONS[cat]}</p>
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
                          background: lightMode ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.03)',
                          borderLeft: lightMode ? '3px solid rgba(0,0,0,0.15)' : '3px solid rgba(255,255,255,0.15)',
                          borderRadius: '4px',
                        }}>
                          <span style={{ fontSize: '13px', color: lightMode ? 'rgba(0,0,0,0.65)' : 'rgba(255,255,255,0.65)', lineHeight: 1.7 }}>
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
                        <div style={{ fontSize: '22px', fontWeight: '900', color: 'white', marginBottom: '8px' }}>
                          {pb ? formatVal(tt, pb.value) : '—'}
                        </div>
                        {(() => {
                          const sport = profile?.sport || ''
                          const gender = profile?.gender === 'female' ? 'female' : 'male'
                          const ageCategory = profile?.age_category || ''
                          const isRingette = sport === 'Ringette'
                          const benchKey = isRingette ? 'ringette' : gender
                          const ladder = isRingette ? LEVEL_LADDERS['ringette'] : LEVEL_LADDERS[gender]
                          const athleteLadderIdx = ladder.indexOf(ageCategory)
                          const bench = BENCHMARKS[benchKey]?.[tt]
                          if (!bench || !pb) return null

                          const athleteValue = (() => {
                            if (['squat', 'bench_press', 'trap_bar_deadlift'].includes(tt)) {
                              const r = (allTestResults || []).filter(r => r.test_type === tt).sort((a,b) => new Date(b.date_tested) - new Date(a.date_tested))[0]
                              if (r?.load_value && r?.reps) return calcE1RM(r.load_value, r.reps)
                            }
                            return pb.value
                          })()

                          const bodyweightLbs = latestMeasurement?.weight || null
                          const isLower = bench.lowerIsBetter
                          const isRelativeOnly = bench.relativeOnly

                          // Get tier
                          const getTier = () => {
                            if (isRelativeOnly) {
                              if (!athleteValue || !bodyweightLbs) return null
                              const relVal = athleteValue / bodyweightLbs
                              const targets = bench.relativeTargets || []
                              let bestTier = 'Developing'
                              let bestIdx = -1
                              targets.forEach(target => {
                                if (relVal >= target.min) {
                                  const targetIdx = Math.max(...target.levels.map(l => ladder.indexOf(l)).filter(i => i >= 0))
                                  if (targetIdx > bestIdx) {
                                    bestIdx = targetIdx
                                    const gap = targetIdx - athleteLadderIdx
                                    if (gap >= 2) bestTier = 'Elite Trajectory'
                                    else if (gap >= 1) bestTier = 'Advanced'
                                    else if (gap >= 0) bestTier = 'On Track'
                                    else bestTier = 'Developing'
                                  }
                                }
                              })
                              return bestTier
                            }
                            const levels = (bench.levels || []).filter(l => l.value != null)
                            if (levels.length === 0) return null
                            const beats = (val, bmark) => isLower ? val <= bmark : val >= bmark
                            const beaten = levels.filter(l => beats(athleteValue, l.value))
                            if (beaten.length === 0) return 'Developing'
                            const getIdx = lvl => ladder.indexOf(lvl)
                            const highest = beaten.reduce((best, l) => getIdx(l.level) > getIdx(best.level) ? l : best, beaten[0])
                            const gap = getIdx(highest.level) - athleteLadderIdx
                            if (gap >= 2) return 'Elite Trajectory'
                            if (gap >= 1) return 'Advanced'
                            if (gap >= 0) return 'On Track'
                            return 'Developing'
                          }

                          const tier = getTier()
                          if (!tier) return null
                          const tierColor = TIER_COLORS[tier]

                          // Find next target
                          const getNextTarget = () => {
                            if (isRelativeOnly) {
                              if (!bodyweightLbs) return null
                              const relVal = athleteValue / bodyweightLbs
                              return (bench.relativeTargets || []).find(t => relVal < t.min)
                            }
                            if (bench.tieredTargets) {
                              const currentTierData = bench.tieredTargets.find(t => t.levels.some(l => l === ageCategory || ladder.indexOf(l) >= athleteLadderIdx))
                              if (!currentTierData) return null
                              const tiers = [
                                { label: 'Bronze', val: currentTierData.bronze },
                                { label: 'Silver', val: currentTierData.silver },
                                { label: 'Gold', val: currentTierData.gold },
                              ]
                              return tiers.find(t => athleteValue < t.val)
                            }
                            const levels = (bench.levels || []).filter(l => l.value != null)
                            const remaining = levels.filter(l => isLower ? athleteValue > l.value : athleteValue < l.value)
                            if (remaining.length === 0) return null
                            const next = isLower
                              ? remaining.reduce((a, b) => a.value > b.value ? a : b)
                              : remaining.reduce((a, b) => a.value < b.value ? a : b)
                            return { level: next.level, value: next.value, confidence: next.confidence }
                          }
                          const nextTarget = getNextTarget()

                          return (
                            <div style={{ marginBottom: '10px' }}>

                              {/* Tier badge */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: tierColor, flexShrink: 0 }} />
                                <div style={{ fontSize: '11px', fontWeight: '700', color: tierColor, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{tier}</div>
                                {isRelativeOnly && bodyweightLbs && (
                                  <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', marginLeft: 'auto' }}>
                                    {(athleteValue / bodyweightLbs).toFixed(2)}× BW
                                  </div>
                                )}

                              </div>
                              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', marginBottom: '16px' }}>
                                {tier === 'Elite Trajectory' ? 'Top 10% of athletes tested at PFA' : tier === 'Advanced' ? 'Above average for age group' : tier === 'On Track' ? 'Meeting expected standards' : 'Room to grow — keep training'}
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                                <div style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#3fae52' }}>
                                  {profile?.sport?.toLowerCase().includes('hockey') ? 'Hockey Development Benchmarks' : profile?.sport?.toLowerCase().includes('soccer') ? 'Soccer Development Benchmarks' : 'Hockey Development Benchmarks'}
                                </div>
                              </div>

                              {/* Chip track — standard tests */}
                              {!isRelativeOnly && !bench.tieredTargets && !bench.relativeTargets && (bench.levels || []).some(l => l.value != null) && (
                                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px', marginBottom: '14px' }}>
                                  {(() => {
                                    const visibleLevels = ladder
                                      .map((lvl, idx) => ({ lvl, idx, bench: (bench.levels || []).find(l => l.level === lvl) }))
                                      .filter(({ bench: b }) => b?.value != null)

                                    const beatenIdxs = visibleLevels.filter(({ bench: b }) => isLower ? athleteValue <= b.value : athleteValue >= b.value).map(({ idx }) => idx)
                                    const highestBeatenIdx = beatenIdxs.length > 0 ? Math.max(...beatenIdxs) : -1
                                    const youInserted = { done: false }

                                    return visibleLevels.map(({ lvl, idx, bench: lvlBench }, i) => {
                                      const shortName = lvl.replace('HC ', '').replace('/Pro', '').replace('Olympic/', '').replace('-age', '').replace('CHL-age', 'CHL')
                                      const beats = isLower ? athleteValue <= lvlBench.value : athleteValue >= lvlBench.value
                                      const isFirstUnbeaten = !beats && highestBeatenIdx < idx && !youInserted.done
                                      if (isFirstUnbeaten) youInserted.done = true
                                      const isYouAfterAll = i === visibleLevels.length - 1 && !youInserted.done && highestBeatenIdx === -1

                                      return (
                                        <React.Fragment key={lvl}>
                                          {i > 0 && <div style={{ color: 'rgba(255,255,255,0.12)', fontSize: '10px' }}>·</div>}
                                          {beats ? (
                                            <div
                                              style={tooltipStyle}
                                              onMouseEnter={e => { const t = e.currentTarget.querySelector('.chip-tooltip'); if (t) { t.style.visibility = 'visible'; t.style.opacity = '1' } }}
                                              onMouseLeave={e => { const t = e.currentTarget.querySelector('.chip-tooltip'); if (t) { t.style.visibility = 'hidden'; t.style.opacity = '0' } }}
                                              onClick={e => { const t = e.currentTarget.querySelector('.chip-tooltip'); if (t) { t.style.visibility = t.style.visibility === 'visible' ? 'hidden' : 'visible'; t.style.opacity = t.style.opacity === '1' ? '0' : '1' } }}
                                            >
                                              <div style={{ padding: '4px 10px', borderRadius: '999px', background: 'rgba(63,174,82,0.12)', border: '1px solid rgba(63,174,82,0.25)', color: '#3fae52', fontSize: '11px', fontWeight: '700', whiteSpace: 'nowrap', cursor: 'help' }}>✓ {shortName}</div>
                                              <div className="chip-tooltip" style={tooltipTextStyle}>{CHIP_TOOLTIPS[gender]?.[tt]?.[shortName] || shortName}</div>
                                            </div>
                                          ) : isFirstUnbeaten ? (
                                            <>
                                              <div style={{ padding: '4px 10px', borderRadius: '999px', background: `${tierColor}22`, border: `1.5px solid ${tierColor}`, color: tierColor, fontSize: '11px', fontWeight: '700', whiteSpace: 'nowrap' }}>YOU</div>
                                              <div style={{ color: 'rgba(255,255,255,0.12)', fontSize: '10px' }}>·</div>
                                              <div
                                                style={tooltipStyle}
                                                onMouseEnter={e => { const t = e.currentTarget.querySelector('.chip-tooltip'); if (t) { t.style.visibility = 'visible'; t.style.opacity = '1' } }}
                                                onMouseLeave={e => { const t = e.currentTarget.querySelector('.chip-tooltip'); if (t) { t.style.visibility = 'hidden'; t.style.opacity = '0' } }}
                                                onClick={e => { const t = e.currentTarget.querySelector('.chip-tooltip'); if (t) { t.style.visibility = t.style.visibility === 'visible' ? 'hidden' : 'visible'; t.style.opacity = t.style.opacity === '1' ? '0' : '1' } }}
                                              >
                                                <div style={{ padding: '4px 10px', borderRadius: '999px', background: lightMode ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.04)', border: '1.5px solid #3fae52', color: '#3fae52', fontSize: '11px', fontWeight: '700', whiteSpace: 'nowrap', cursor: 'help' }}>→ {shortName}</div>
                                                <div className="chip-tooltip" style={tooltipTextStyle}>{CHIP_TOOLTIPS[gender]?.[tt]?.[shortName] || shortName}</div>
                                              </div>
                                            </>
                                          ) : isYouAfterAll ? (
                                            <>
                                              <div style={{ color: 'rgba(255,255,255,0.12)', fontSize: '10px' }}>·</div>
                                              <div style={{ padding: '4px 10px', borderRadius: '999px', background: `${tierColor}22`, border: `1.5px solid ${tierColor}`, color: tierColor, fontSize: '11px', fontWeight: '700', whiteSpace: 'nowrap' }}>YOU</div>
                                            </>
                                          ) : (
                                            <div
                                              style={tooltipStyle}
                                              onMouseEnter={e => { const t = e.currentTarget.querySelector('.chip-tooltip'); if (t) { t.style.visibility = 'visible'; t.style.opacity = '1' } }}
                                              onMouseLeave={e => { const t = e.currentTarget.querySelector('.chip-tooltip'); if (t) { t.style.visibility = 'hidden'; t.style.opacity = '0' } }}
                                              onClick={e => { const t = e.currentTarget.querySelector('.chip-tooltip'); if (t) { t.style.visibility = t.style.visibility === 'visible' ? 'hidden' : 'visible'; t.style.opacity = t.style.opacity === '1' ? '0' : '1' } }}
                                            >
                                              <div style={{ padding: '4px 10px', borderRadius: '999px', background: lightMode ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.03)', border: `1px solid ${lightMode ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.08)'}`, color: lightMode ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.2)', fontSize: '11px', fontWeight: '700', whiteSpace: 'nowrap', cursor: 'help' }}>{shortName}</div>
                                              <div className="chip-tooltip" style={tooltipTextStyle}>{CHIP_TOOLTIPS[gender]?.[tt]?.[shortName] || shortName}</div>
                                            </div>
                                          )}
                                        </React.Fragment>
                                      )
                                    })
                                  })()}
                                </div>
                              )}

                              {/* Chip track — relative targets */}
                              {(isRelativeOnly || (bench.relativeTargets && bodyweightLbs)) && !bench.tieredTargets && (
                                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px', marginBottom: '14px' }}>
                                  {(bench.relativeTargets || []).map((target, idx) => {
                                    const relVal = bodyweightLbs ? athleteValue / bodyweightLbs : 0
                                    const meets = relVal >= target.min
                                    const clearedCount = (bench.relativeTargets || []).filter(t => relVal >= t.min).length
                                    const isHere = meets && idx === clearedCount - 1
                                    const isNext = idx === clearedCount && !meets
                                    return (
                                      <React.Fragment key={idx}>
                                        {idx > 0 && <div style={{ color: 'rgba(255,255,255,0.12)', fontSize: '10px' }}>·</div>}
                                        {isHere && meets ? (
                                          <div style={{ padding: '4px 10px', borderRadius: '999px', background: `${tierColor}22`, border: `1.5px solid ${tierColor}`, color: tierColor, fontSize: '11px', fontWeight: '700', whiteSpace: 'nowrap' }}>YOU</div>
                                        ) : meets ? (
                                          <div
                                            style={tooltipStyle}
                                            onMouseEnter={e => { const t = e.currentTarget.querySelector('.chip-tooltip'); if (t) { t.style.visibility = 'visible'; t.style.opacity = '1' } }}
                                            onMouseLeave={e => { const t = e.currentTarget.querySelector('.chip-tooltip'); if (t) { t.style.visibility = 'hidden'; t.style.opacity = '0' } }}
                                            onClick={e => { const t = e.currentTarget.querySelector('.chip-tooltip'); if (t) { t.style.visibility = t.style.visibility === 'visible' ? 'hidden' : 'visible'; t.style.opacity = t.style.opacity === '1' ? '0' : '1' } }}
                                          >
                                            <div style={{ padding: '4px 10px', borderRadius: '999px', background: 'rgba(63,174,82,0.12)', border: '1px solid rgba(63,174,82,0.25)', color: '#3fae52', fontSize: '11px', fontWeight: '700', whiteSpace: 'nowrap', cursor: 'help' }}>✓ {target.label}</div>
                                            <div className="chip-tooltip" style={tooltipTextStyle}>{CHIP_TOOLTIPS[gender]?.[tt]?.[target.label] || target.label}</div>
                                          </div>
                                        ) : isNext ? (
                                          <div
                                            style={tooltipStyle}
                                            onMouseEnter={e => { const t = e.currentTarget.querySelector('.chip-tooltip'); if (t) { t.style.visibility = 'visible'; t.style.opacity = '1' } }}
                                            onMouseLeave={e => { const t = e.currentTarget.querySelector('.chip-tooltip'); if (t) { t.style.visibility = 'hidden'; t.style.opacity = '0' } }}
                                            onClick={e => { const t = e.currentTarget.querySelector('.chip-tooltip'); if (t) { t.style.visibility = t.style.visibility === 'visible' ? 'hidden' : 'visible'; t.style.opacity = t.style.opacity === '1' ? '0' : '1' } }}
                                          >
                                            <div style={{ padding: '4px 10px', borderRadius: '999px', background: lightMode ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.04)', border: '1.5px solid #3fae52', color: '#3fae52', fontSize: '11px', fontWeight: '700', whiteSpace: 'nowrap', cursor: 'help' }}>→ {target.label}</div>
                                            <div className="chip-tooltip" style={tooltipTextStyle}>{CHIP_TOOLTIPS[gender]?.[tt]?.[target.label] || target.label}</div>
                                          </div>
                                        ) : (
                                          <div
                                            style={tooltipStyle}
                                            onMouseEnter={e => { const t = e.currentTarget.querySelector('.chip-tooltip'); if (t) { t.style.visibility = 'visible'; t.style.opacity = '1' } }}
                                            onMouseLeave={e => { const t = e.currentTarget.querySelector('.chip-tooltip'); if (t) { t.style.visibility = 'hidden'; t.style.opacity = '0' } }}
                                            onClick={e => { const t = e.currentTarget.querySelector('.chip-tooltip'); if (t) { t.style.visibility = t.style.visibility === 'visible' ? 'hidden' : 'visible'; t.style.opacity = t.style.opacity === '1' ? '0' : '1' } }}
                                          >
                                            <div style={{ padding: '4px 10px', borderRadius: '999px', background: lightMode ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.03)', border: `1px solid ${lightMode ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.08)'}`, color: lightMode ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.2)', fontSize: '11px', fontWeight: '700', whiteSpace: 'nowrap', cursor: 'help' }}>{target.label}</div>
                                            <div className="chip-tooltip" style={tooltipTextStyle}>{CHIP_TOOLTIPS[gender]?.[tt]?.[target.label] || target.label}</div>
                                          </div>
                                        )}
                                      </React.Fragment>
                                    )
                                  })}
                                </div>
                              )}

                              {/* Chip track — tiered targets (push-ups etc) */}
                              {bench.tieredTargets && (
                                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px', marginBottom: '14px' }}>
                                  {(() => {
                                    const currentTierData = bench.tieredTargets.find(t => t.levels.some(l => l === ageCategory || ladder.indexOf(l) >= athleteLadderIdx))
                                    if (!currentTierData) return null
                                    const tiers = [
                                      { label: 'Bronze', val: currentTierData.bronze, color: '#cd7f32' },
                                      { label: 'Silver', val: currentTierData.silver, color: '#9ca3af' },
                                      { label: 'Gold', val: currentTierData.gold, color: '#f59e0b' },
                                    ]
                                    const clearedCount = tiers.filter(t => athleteValue >= t.val).length
                                    return tiers.map((t, idx) => {
                                      const meets = athleteValue >= t.val
                                      const isHere = idx === clearedCount - 1 && meets
                                      const isNext = idx === clearedCount && !meets
                                      return (
                                        <React.Fragment key={t.label}>
                                          {idx > 0 && <div style={{ color: 'rgba(255,255,255,0.12)', fontSize: '10px' }}>·</div>}
                                          {isHere ? (
                                            <div style={{ padding: '4px 10px', borderRadius: '999px', background: `${t.color}22`, border: `1.5px solid ${t.color}`, color: t.color, fontSize: '11px', fontWeight: '700', whiteSpace: 'nowrap' }}>YOU</div>
                                          ) : meets ? (
                                            <div style={{ padding: '4px 10px', borderRadius: '999px', background: `${t.color}18`, border: `1px solid ${t.color}44`, color: t.color, fontSize: '11px', fontWeight: '700', whiteSpace: 'nowrap' }}>✓ {t.label}</div>
                                          ) : isNext ? (
                                            <div style={{ padding: '4px 10px', borderRadius: '999px', background: lightMode ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.04)', border: '1.5px solid #3fae52', color: '#3fae52', fontSize: '11px', fontWeight: '700', whiteSpace: 'nowrap' }}>→ {t.label}</div>
                                          ) : (
                                            <div style={{ padding: '4px 10px', borderRadius: '999px', background: lightMode ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.03)', border: `1px solid ${lightMode ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.08)'}`, color: lightMode ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.2)', fontSize: '11px', fontWeight: '700', whiteSpace: 'nowrap' }}>{t.label}</div>
                                          )}
                                        </React.Fragment>
                                      )
                                    })
                                  })()}
                                </div>
                              )}

                              {/* Comparison card — next target */}
                              {nextTarget && !isRelativeOnly && !bench.tieredTargets && nextTarget.value && athleteValue && (
                                <div style={{ background: 'rgba(255,255,255,0.02)', borderLeft: '2px solid rgba(255,255,255,0.08)', borderRadius: '0 6px 6px 0', padding: '10px 12px', fontSize: '12px', color: 'rgba(255,255,255,0.5)', lineHeight: '1.7', marginBottom: '12px' }}>
                                  {(() => {
                                    const clearedLevels = (bench.levels || []).filter(l => l.value != null && (isLower ? athleteValue <= l.value : athleteValue >= l.value))
                                    const clearedNames = clearedLevels.map(l => l.level.replace('HC ', '').replace('/Pro','').replace('Olympic/','').replace('-age','').replace('CHL-age','CHL'))
                                    const nextName = nextTarget.level.replace('HC ', '').replace('/Pro','').replace('Olympic/','').replace('-age','').replace('CHL-age','CHL')
                                    const gapFormatted = isLower
                                      ? `${(athleteValue - nextTarget.value).toFixed(3)}s`
                                      : formatVal(tt, Math.abs(nextTarget.value - athleteValue))
                                    if (clearedLevels.length > 0) {
                                      return (
                                        <span>
                                          {profile?.full_name?.split(' ')[0]} has already cleared the <strong style={{ color: 'white' }}>{clearedNames.join(', ')}</strong> benchmark{clearedLevels.length > 1 ? 's' : ''}. The next target is the <strong style={{ color: 'white' }}>{nextName} standard</strong> — just <strong style={{ color: '#3fae52' }}>{gapFormatted} away</strong>.
                                        </span>
                                      )
                                    } else {
                                      return (
                                        <span>
                                          The next target is the <strong style={{ color: 'white' }}>{nextName} standard</strong>. {profile?.full_name?.split(' ')[0]} is <strong style={{ color: '#3fae52' }}>{gapFormatted} away</strong> from hitting this benchmark.
                                        </span>
                                      )
                                    }
                                  })()}
                                </div>
                              )}
                              {nextTarget && !isRelativeOnly && !bench.tieredTargets && nextTarget.value && athleteValue && (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1px 1fr', background: lightMode ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.03)', border: lightMode ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(255,255,255,0.07)', borderRadius: '8px', overflow: 'hidden', marginBottom: '10px' }}>
                                  <div style={{ padding: '10px 14px' }}>
                                    <div style={{ fontSize: '9px', fontWeight: '700', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: '3px' }}>Today</div>
                                    <div style={{ fontSize: '20px', fontWeight: '900', color: lightMode ? '#111' : 'white' }}>{formatVal(tt, athleteValue)}</div>
                                  </div>
                                  <div style={{ background: 'rgba(255,255,255,0.07)' }} />
                                  <div style={{ padding: '10px 14px' }}>
                                    <div style={{ fontSize: '9px', fontWeight: '700', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: '3px' }}>{nextTarget.level}</div>
                                    <div style={{ fontSize: '20px', fontWeight: '900', color: lightMode ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.2)' }}>{formatVal(tt, nextTarget.value)}</div>
                                    <div style={{ fontSize: '11px', fontWeight: '700', color: '#3fae52', marginTop: '3px' }}>
                                      {isLower ? `${(athleteValue - nextTarget.value).toFixed(3)}s to go` : `${formatVal(tt, Math.abs(nextTarget.value - athleteValue))} to go`}
                                    </div>
                                  </div>
                                </div>
                              )}

                            </div>
                          )
                        })()}
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
                                <span style={{ color: lightMode ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.4)' }}>HNB Standard</span>
                                <span style={{ color: lightMode ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)', fontWeight: '600' }}>{formatVal(tt, hnbBench.value)}</span>
                              </div>
                            )}
                            {hcBench && (
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                                <span style={{ color: lightMode ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.4)' }}>Hockey Canada</span>
                                <span style={{ color: lightMode ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)', fontWeight: '600' }}>{formatVal(tt, hcBench.value)}</span>
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
                      background: lightMode ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.03)',
                      borderRadius: '8px',
                      border: lightMode ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(255,255,255,0.06)',
                      color: lightMode ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.35)',
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

          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr 1fr 1fr', gap: '10px', marginBottom: '16px' }}>
            {[
              { label: 'Overall', key: 'overall', score: compScore?.overall_score },
              { label: 'Speed', key: 'speed', score: compScore?.speed_score },
              { label: 'Strength', key: 'strength', score: compScore?.strength_score },
              { label: 'Power', key: 'power', score: compScore?.power_score },
              { label: 'Agility', key: 'agility', score: compScore?.agility_score },
              { label: 'Endurance', key: 'endurance', score: compScore?.endurance_score },
            ].map(({ label, key, score }, i) => {
              const s = Math.round(score || 0)
              const isOverall = key === 'overall'
              const zoneColor = s >= 75 ? '#3fae52' : s >= 50 ? '#f59e0b' : '#ef4444'
              const zoneLabel = s >= 75 ? 'Strong' : s >= 50 ? 'Above avg' : 'Developing'
              return (
                <div key={key} style={{ background: '#0d1a0d', border: `1px solid ${isOverall ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)'}`, borderRadius: '10px', padding: isOverall ? '16px 18px' : '14px 16px' }}>
                  <div style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: '6px' }}>{label}</div>
                  <div style={{ fontSize: isOverall ? '52px' : '36px', fontWeight: '900', lineHeight: '1', marginBottom: '10px', color: zoneColor }}>{s}</div>
                  <div style={{ position: 'relative', height: '8px', background: lightMode ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)', borderRadius: '999px', marginBottom: '6px', overflow: 'visible' }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, width: '49%', height: '100%', background: 'rgba(239,68,68,0.5)', borderRadius: '999px 0 0 999px' }} />
                    <div style={{ position: 'absolute', top: 0, left: '49%', width: '26%', height: '100%', background: 'rgba(245,158,11,0.5)' }} />
                    <div style={{ position: 'absolute', top: 0, left: '75%', width: '25%', height: '100%', background: 'rgba(63,174,82,0.6)', borderRadius: '0 999px 999px 0' }} />
                    <div style={{ position: 'absolute', top: '-3px', left: '50%', width: '1px', height: '14px', background: 'rgba(255,255,255,0.25)' }} />
                    <div style={{ position: 'absolute', top: '50%', left: `${s}%`, transform: 'translate(-50%, -50%)', width: '14px', height: '14px', borderRadius: '50%', background: zoneColor, border: '2px solid #0a0f0a', zIndex: 10 }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.25)' }}>{isOverall ? 'Peer avg: 50' : 'avg: 50'}</div>
                    <div style={{ fontSize: '9px', fontWeight: '700', color: zoneColor }}>{zoneLabel}</div>
                  </div>
                </div>
              )
            })}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', padding: '10px 14px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', marginBottom: '16px' }}>
            <div style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', marginRight: '4px' }}>Zones:</div>
            {[
              { color: 'rgba(239,68,68,0.5)', label: 'Developing (0–49)' },
              { color: 'rgba(245,158,11,0.5)', label: 'Average (50–74)' },
              { color: 'rgba(63,174,82,0.6)', label: 'Strong (75–100)' },
            ].map(z => (
              <div key={z.label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: z.color }} />
                <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)' }}>{z.label}</span>
              </div>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <div style={{ width: '1px', height: '12px', background: 'rgba(255,255,255,0.25)' }} />
              <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)' }}>Peer average</span>
            </div>
          </div>

          {(() => {
            if (insights?.scores_summary) {
              return (
                <div style={{ fontSize: '13px', color: lightMode ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.55)', lineHeight: 1.7, marginTop: '16px', padding: '14px 16px', background: lightMode ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.03)', borderLeft: '3px solid rgba(63,174,82,0.3)', borderRadius: '4px' }}>
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
              <div style={{ fontSize: '13px', color: lightMode ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.55)', lineHeight: 1.7, marginTop: '16px', padding: '14px 16px', background: lightMode ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.03)', borderLeft: '3px solid rgba(63,174,82,0.3)', borderRadius: '4px' }}>
                {`${firstName}'s strongest category is ${top[0]} with a score of ${top[1]}, standing out among ${profile?.gender} ${profile?.age_category} peers. ${bottom[0]} is the current development focus with a score of ${bottom[1]} — an active priority in ${pronoun} training program.`}
              </div>
            )
          })()}
        </div>

        {/* ── SECTION 6: INSIGHTS ── */}
        {insights?.what_to_watch && (
          <>
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
              maxWidth: '1100px',
              margin: '32px auto 40px auto',
              padding: isMobile ? '0 16px' : '0 24px',
              fontSize: '1.05rem',
              color: lightMode ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.8)',
              fontStyle: 'italic',
              lineHeight: 1.7,
              borderLeft: '3px solid #3fae52',
              paddingLeft: '16px'
            }}>
              {insights.what_to_watch}
            </div>
          </>
        )}

        {insights?.next_steps && (
          <>
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
              maxWidth: '1100px',
              margin: '32px auto 40px auto',
              padding: isMobile ? '0 16px' : '0 24px',
              fontSize: '1.05rem',
              color: lightMode ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.8)',
              fontStyle: 'italic',
              lineHeight: 1.7,
              borderLeft: '3px solid #3fae52',
              paddingLeft: '16px'
            }}>
              {insights.next_steps}
            </div>
          </>
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
                <div style={{ color: lightMode ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)', fontSize: '12px' }}>688 Babin St, Dieppe, NB, E1A 5M1</div>
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
