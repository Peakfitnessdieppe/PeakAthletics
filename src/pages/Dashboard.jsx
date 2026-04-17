import React, { useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import useAuth from '../hooks/useAuth'
import { supabase } from '../services/supabase'

const DASH_CATEGORY_COLORS = {
  SPEED: '#3fae52',
  POWER: '#f59e0b',
  STRENGTH: '#ef4444',
  AGILITY: '#8b5cf6',
  ENDURANCE: '#06b6d4',
  ANTHROPOMETRICS: '#ec4899',
}

const STRENGTH_LOAD_TESTS = ['squat', 'bench_press', 'trap_bar_deadlift']

const calcE1RM = (load, reps) => {
  if (!load || !reps || reps === 1) return load
  return Math.round(load * (1 + reps / 30))
}

const calcRelativeStrength = (e1rm, bodyweightLbs) => {
  if (!e1rm || !bodyweightLbs) return null
  return Math.round((e1rm / bodyweightLbs) * 100) / 100
}

const DASH_TEST_LABELS = {
  '10m_sprint': '10m Sprint',
  vertical_jump: 'Vertical Jump',
  broad_jump: 'Broad Jump',
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

const DASH_TEST_UNITS = {
  '10m_sprint': 's',
  vertical_jump: 'cm',
  broad_jump: 'm',
  mb_chest_pass: 'm',
  pro_agility_shuttle: 's',
  beep_test: 'lvl',
  squat: 'lbs',
  trap_bar_deadlift: 'lbs',
  bench_press: 'lbs',
  pull_ups: 'reps',
  push_ups: 'reps',
  imtp: 'lbs',
}

const Dashboard = () => {
  const navigate = useNavigate()
  const { user, profile, loading, signOut } = useAuth()

  const [teams, setTeams] = useState([])
  const [roster, setRoster] = useState([])
  const [scores, setScores] = useState({})
  const [lastTested, setLastTested] = useState({})
  const [activeTab, setActiveTab] = useState('roster')
  const [leaderboardCategory, setLeaderboardCategory] = useState('Speed')
  const [scoreHistory, setScoreHistory] = useState({})
  const [insights, setInsights] = useState({
    fastest: null,
    mostExplosive: null,
    strongest: null,
    conditioning: null,
    mostAgile: null,
  })
  const [needsTesting, setNeedsTesting] = useState([])
  const [selectedAthlete, setSelectedAthlete] = useState(null)
  const [athleteResults, setAthleteResults] = useState([])
  const [athleteBodyweight, setAthleteBodyweight] = useState([])
  const [allResultsState, setAllResultsState] = useState([])
  const [gameStatsState, setGameStatsState] = useState([])
  const [search, setSearch] = useState('')
  const [historySearch, setHistorySearch] = useState('')
  const [historyCategory, setHistoryCategory] = useState('All')
  const [expandedHistoryDates, setExpandedHistoryDates] = useState({})
  const [coachInsights, setCoachInsights] = useState(null)
  const [coachInsightsLoading, setCoachInsightsLoading] = useState(false)
  const [coachInsightsDate, setCoachInsightsDate] = useState(null)

  useEffect(() => {
    if (!profile?.id) return
    loadData()
  }, [profile?.id])

  useEffect(() => {
    if (!teams.length || !profile?.id) return
    const teamId = teams[0]?.id
    if (!teamId) return
    const fetchCoachInsights = async () => {
      setCoachInsightsLoading(true)
      try {
        const res = await fetch('/.netlify/functions/generate-coach-insights', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ teamId }),
        })
        const data = await res.json()
        if (data?.insight) {
          setCoachInsights(data.insight)
          setCoachInsightsDate(data.test_session_date)
        }
      } catch (err) {
        console.error('Coach insights fetch error:', err)
      } finally {
        setCoachInsightsLoading(false)
      }
    }
    fetchCoachInsights()
  }, [teams, profile?.id])

  useEffect(() => {
    const fetchAthleteResults = async () => {
      if (!selectedAthlete) return
      try {
        const { data } = await supabase
          .from('pfa_test_results')
          .select('test_type, value, date_tested, category, load_value, reps, relative_strength')
          .eq('athlete_id', selectedAthlete)
          .order('date_tested', { ascending: false })
          .limit(20)
        setAthleteResults(data || [])
        const { data: bwData } = await supabase
          .from('pfa_body_measurements')
          .select('weight, body_fat_percentage, height, measurement_date')
          .eq('athlete_id', selectedAthlete)
          .order('measurement_date', { ascending: false })
          .limit(3)
        setAthleteBodyweight(bwData || [])
      } catch (err) {
        console.error('Load athlete results failed', err)
      }
    }
    fetchAthleteResults()
  }, [selectedAthlete])

  const loadData = async () => {
    try {
      let teamData = []
      try {
        const { data, error } = await supabase
          .from('pfa_teams')
          .select('id, name, sport, age_category, competition_level, primary_color')
          .eq('coach_id', profile.id)
        if (error) console.warn('[Dashboard] query failed: teams', error.message)
        else {
          teamData = data || []
          setTeams(teamData)
        }
      } catch (e) {
        console.warn('[Dashboard] query exception: teams', e)
      }

      console.log('[Dashboard] teamData:', teamData)
      if (!teamData || teamData.length === 0) return

      const teamIds = teamData.map((t) => t.id)

      let athleteTeamLinks = []
      try {
        const { data, error } = await supabase
          .from('athlete_teams')
          .select('athlete_id, team_id')
          .in('team_id', teamIds)
        if (error) console.warn('[Dashboard] query failed: athlete_teams', error.message)
        else athleteTeamLinks = data || []
      } catch (e) {
        console.warn('[Dashboard] query exception: athlete_teams', e)
      }

      console.log('[Dashboard] athleteTeamLinks:', athleteTeamLinks)
      const athleteIds = [...new Set((athleteTeamLinks || []).map((r) => r.athlete_id))]
      console.log('[Dashboard] athleteIds:', athleteIds)

      if (athleteIds.length === 0) {
        setRoster([])
        return
      }

      let athleteProfiles = []
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, full_name, sport, position, age_category, gender, avatar_url, role')
          .in('id', athleteIds)
          .eq('role', 'athlete')
        if (error) console.warn('[Dashboard] query failed: profiles', error.message)
        else {
          athleteProfiles = data || []
          setRoster(athleteProfiles)
        }
      } catch (e) {
        console.warn('[Dashboard] query exception: profiles', e)
      }

      console.log('[Dashboard] athleteProfiles:', athleteProfiles)
      const rosterList = athleteProfiles || []

      let scoreData = []
      try {
        const { data, error } = await supabase
          .from('pfa_composite_scores')
          .select('athlete_id, overall_score, speed_score, power_score, strength_score, agility_score, endurance_score, calculated_at')
          .in('athlete_id', athleteIds)
          .order('calculated_at', { ascending: false })
        if (error) console.warn('[Dashboard] query failed: composite scores', error.message)
        else scoreData = data || []
      } catch (e) {
        console.warn('[Dashboard] query exception: composite scores', e)
      }

      const latestScores = {}
      const history = {}
      ;(scoreData || []).forEach((s) => {
        if (!latestScores[s.athlete_id]) latestScores[s.athlete_id] = s
        if (!history[s.athlete_id]) history[s.athlete_id] = []
        history[s.athlete_id].push(s.overall_score)
      })

      let lastData = []
      try {
        const { data, error } = await supabase
          .from('pfa_test_results')
          .select('athlete_id, date_tested')
          .in('athlete_id', athleteIds)
          .order('date_tested', { ascending: false })
        if (error) console.warn('[Dashboard] query failed: last tested', error.message)
        else lastData = data || []
      } catch (e) {
        console.warn('[Dashboard] query exception: last tested', e)
      }

      let allResults = []
      const { data: allResultsData, error: allResultsError } = await supabase
        .from('pfa_test_results')
        .select('athlete_id, test_type, value, date_tested, category, load_value, reps, relative_strength')
        .in('athlete_id', athleteIds)
        .order('date_tested', { ascending: false })
      console.log('[Dashboard] allResults error:', allResultsError)
      console.log('[Dashboard] allResults:', allResultsData?.length, 'records')
      allResults = allResultsData || []
      console.log('[Dashboard] allResults count:', allResults?.length)
      console.log('[Dashboard] allResults sample:', allResults?.slice(0, 3))

      const allResultsDataSafe = allResults || []

      // Insights calculations
      // FASTEST — 10m sprint only
      const sprintResults = allResultsDataSafe.filter((r) => r.test_type === '10m_sprint')
      const bestSprintPerAthlete = {}
      for (const r of sprintResults) {
        if (!bestSprintPerAthlete[r.athlete_id] || r.value < bestSprintPerAthlete[r.athlete_id].value) {
          bestSprintPerAthlete[r.athlete_id] = r
        }
      }
      const fastestEntry = Object.values(bestSprintPerAthlete).sort((a, b) => a.value - b.value)[0]

      // MOST EXPLOSIVE — highest power_score
      const powerLeader = Object.values(latestScores)
        .filter((s) => typeof s?.power_score === 'number')
        .sort((a, b) => b.power_score - a.power_score)[0]

      const bestVert = powerLeader
        ? allResultsDataSafe
            .filter((r) => r.athlete_id === powerLeader.athlete_id && r.test_type === 'vertical_jump')
            .sort((a, b) => b.value - a.value)[0]
        : null
      const bestBroad = powerLeader
        ? allResultsDataSafe
            .filter((r) => r.athlete_id === powerLeader.athlete_id && r.test_type === 'broad_jump')
            .sort((a, b) => b.value - a.value)[0]
        : null

      // STRONGEST — highest strength_score, show per-test e1RM rows
      const strengthLeader = Object.values(latestScores)
        .filter((s) => typeof s?.strength_score === 'number')
        .sort((a, b) => b.strength_score - a.strength_score)[0]

      const strengthLiftRows = strengthLeader
        ? STRENGTH_LOAD_TESTS.map((testType) => {
            const rows = allResultsDataSafe
              .filter((r) => r.athlete_id === strengthLeader.athlete_id && r.test_type === testType && r.load_value && r.reps)
              .map((r) => ({ ...r, e1rm: calcE1RM(r.load_value, r.reps) }))
              .filter((r) => r.e1rm)
            if (!rows.length) return null
            const best = rows.sort((a, b) => b.e1rm - a.e1rm)[0]
            return {
              testType,
              load: best.load_value,
              reps: best.reps,
              e1rm: best.e1rm,
              relative_strength: best.relative_strength,
            }
          }).filter(Boolean)
        : []

      // CONDITIONING — beep test
      const beepByAthlete = {}
      for (const r of allResultsDataSafe.filter((r) => r.test_type === 'beep_test')) {
        if (!beepByAthlete[r.athlete_id] || r.value > beepByAthlete[r.athlete_id].value) {
          beepByAthlete[r.athlete_id] = r
        }
      }
      const topBeepEntry = Object.values(beepByAthlete).sort((a, b) => b.value - a.value)[0]

      // MOST AGILE — pro agility shuttle (lower is better)
      const agilityByAthlete = {}
      for (const r of allResultsDataSafe.filter((r) => r.test_type === 'pro_agility_shuttle')) {
        if (!agilityByAthlete[r.athlete_id] || r.value < agilityByAthlete[r.athlete_id].value) {
          agilityByAthlete[r.athlete_id] = r
        }
      }
      const mostAgileEntry = Object.values(agilityByAthlete).sort((a, b) => a.value - b.value)[0]

      const fastestProfile = fastestEntry ? athleteProfiles.find((p) => p.id === fastestEntry.athlete_id) : null
      const mostExplosiveProfile = powerLeader ? athleteProfiles.find((p) => p.id === powerLeader.athlete_id) : null
      const strongestProfile = strengthLeader ? athleteProfiles.find((p) => p.id === strengthLeader.athlete_id) : null
      const topBeepProfile = topBeepEntry ? athleteProfiles.find((p) => p.id === topBeepEntry.athlete_id) : null
      const mostAgileProfile = mostAgileEntry ? athleteProfiles.find((p) => p.id === mostAgileEntry.athlete_id) : null

      const needsTestingList = (() => {
        const now = new Date()
        const lastByAthlete = {}
        ;(allResults || []).forEach((r) => {
          if (!lastByAthlete[r.athlete_id]) lastByAthlete[r.athlete_id] = r.date_tested
        })

        return rosterList.filter((ath) => {
          const lastDate = lastByAthlete[ath.id]
          if (!lastDate) return true
          const daysAgo = Math.floor((now - new Date(lastDate)) / (1000 * 60 * 60 * 24))
          return daysAgo > 60
        })
      })()

      setInsights({
        fastest: fastestEntry
          ? {
              name: fastestProfile?.full_name || 'Unknown',
              value: '10m Sprint: ' + fastestEntry.value + 's',
              position: fastestProfile?.position || '',
            }
          : null,
        mostExplosive: powerLeader
          ? {
              name: mostExplosiveProfile?.full_name || 'Unknown',
              value: 'Power Score: ' + Math.round(powerLeader.power_score),
              position: mostExplosiveProfile?.position || '',
              vertJump: bestVert?.value || null,
              broadJump: bestBroad?.value || null,
            }
          : null,
        strongest: strengthLeader
          ? {
              name: strongestProfile?.full_name || 'Unknown',
              value: typeof strengthLeader.strength_score === 'number' ? `Strength Score: ${Math.round(strengthLeader.strength_score)}` : 'Strength Score: —',
              position: strongestProfile?.position || '',
              lifts: strengthLiftRows,
            }
          : null,
        conditioning: topBeepEntry
          ? {
              name: topBeepProfile?.full_name || 'Unknown',
              value: 'Beep Test: Level ' + topBeepEntry.value,
              position: topBeepProfile?.position || '',
            }
          : null,
        mostAgile: mostAgileEntry
          ? {
              name: mostAgileProfile?.full_name || 'Unknown',
              value: 'Pro Agility: ' + mostAgileEntry.value + 's',
              position: mostAgileProfile?.position || '',
            }
          : null,
      })
      setNeedsTesting(needsTestingList)

      let gameStats = []
      try {
        const { data, error } = await supabase
          .from('game_stats')
          .select('athlete_id, goals, assists, points, season')
          .in('athlete_id', athleteIds)
          .order('season', { ascending: false })
        if (error) console.warn('[Dashboard] query failed: game stats', error.message)
        else gameStats = data || []
      } catch (e) {
        console.warn('[Dashboard] query exception: game stats', e)
      }

      const latestTested = {}
      ;(lastData || []).forEach((l) => {
        if (!latestTested[l.athlete_id]) latestTested[l.athlete_id] = l.date_tested
      })

      setScores(latestScores)
      setLastTested(latestTested)
      setScoreHistory(history)
      setAllResultsState(allResults || [])
      setGameStatsState(gameStats || [])

    } catch (err) {
      console.error('Dashboard load error', err)
    }
  }

  const filteredRoster = useMemo(() => {
    const term = search.toLowerCase()
    return roster.filter((r) => r.full_name?.toLowerCase().includes(term))
  }, [roster, search])

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Never'
    const d = new Date(dateStr)
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const formatResultValue = (testType, value) => {
    const roundToInt = ['squat', 'trap_bar_deadlift', 'bench_press', 'imtp', 'push_ups', 'pull_ups']
    if (roundToInt.includes(testType)) return Math.round(value)
    return parseFloat(Number(value).toFixed(2))
  }

  const getAthleteName = (athleteId) => roster.find((a) => a.id === athleteId)?.full_name || 'Unknown'

  const scorePill = (score) => {
    if (typeof score !== 'number') return { bg: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)', text: '—' }
    if (score >= 70) return { bg: 'rgba(63,174,82,0.2)', color: '#3fae52', text: score }
    if (score >= 50) return { bg: 'rgba(245,158,11,0.2)', color: '#f59e0b', text: score }
    return { bg: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)', text: score }
  }

  if (loading)
    return (
      <div style={{ background: '#0a0f0a', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#3fae52', fontSize: '14px' }}>Loading...</div>
      </div>
    )

  if (profile?.role === 'pfa_admin' || profile?.role === 'pfa_staff') {
    return <Navigate to="/admin" replace />
  }

  if (profile?.role === 'athlete' || profile?.role === 'family') {
    return <Navigate to="/card" replace />
  }

  const navItems = [
    { key: 'roster', label: 'Roster', onClick: () => setActiveTab('roster') },
    { key: 'leaderboards', label: 'Leaderboards', onClick: () => setActiveTab('leaderboards') },
  ]

  const getDaysAgo = (dateStr) => {
    if (!dateStr) return null
    const diff = Date.now() - new Date(dateStr).getTime()
    return Math.floor(diff / (1000 * 60 * 60 * 24))
  }

  const trendForAthlete = (athleteId) => {
    const arr = scoreHistory[athleteId] || []
    if (arr.length < 2) return null
    const newest = arr[0]
    const oldest = arr[arr.length - 1]
    const diff = newest - oldest
    if (diff >= 3) return 'up'
    if (diff <= -3) return 'down'
    return 'flat'
  }

  const scoreColor = (score) => {
    if (typeof score !== 'number') return 'rgba(255,255,255,0.3)'
    if (score >= 70) return '#3fae52'
    if (score >= 50) return '#f59e0b'
    return 'rgba(255,255,255,0.5)'
  }

  const CATEGORY_TESTS = {
    Speed: ['10m_sprint', '30m_sprint', 'pro_agility_shuttle'],
    Power: ['vertical_jump', 'broad_jump', 'ncmj', 'mb_chest_pass'],
    Strength: ['squat', 'trap_bar_deadlift', 'bench_press', 'pull_ups', 'push_ups', 'imtp'],
    Agility: ['pro_agility_shuttle'],
    Endurance: ['beep_test'],
    Conditioning: ['beep_test'],
  }

  const LOWER_IS_BETTER = ['10m_sprint', '30m_sprint', 'pro_agility_shuttle']

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

  const buildLeaderboards = (categoryOverride) => {
    const categoryKey = categoryOverride || leaderboardCategory
    const categoryTests = CATEGORY_TESTS[categoryKey] || []
    const byTest = {}

    categoryTests.forEach((test) => {
      const isLower = LOWER_IS_BETTER.includes(test)
      const bestByAthlete = {}
      ;(allResultsState || [])
        .filter((r) => r.test_type === test)
        .forEach((r) => {
          if (!bestByAthlete[r.athlete_id]) {
            bestByAthlete[r.athlete_id] = r.value
          } else {
            bestByAthlete[r.athlete_id] = isLower
              ? Math.min(bestByAthlete[r.athlete_id], r.value)
              : Math.max(bestByAthlete[r.athlete_id], r.value)
          }
        })

      const entries = Object.entries(bestByAthlete).map(([athleteId, value]) => {
        const athlete = roster.find((r) => r.id === athleteId)
        return {
          athleteId,
          name: athlete?.full_name || 'Unknown',
          position: athlete?.position || '—',
          value,
        }
      })

      entries.sort((a, b) => (isLower ? a.value - b.value : b.value - a.value))
      byTest[test] = entries.slice(0, 10)
    })

    return byTest
  }

  const selectedAthleteProfile = roster.find((r) => r.id === selectedAthlete)
  const selectedAthleteScore = selectedAthlete ? scores[selectedAthlete] : null
  const selectedAthleteGameStats = selectedAthlete ? gameStatsState.find((g) => g.athlete_id === selectedAthlete) : null

  return (
    <div style={{ background: '#0a0f0a', minHeight: '100vh', color: '#fff', display: 'flex', flexDirection: 'column' }}>
      <header
        style={{
          background: '#0d1a0e',
          borderBottom: '1px solid rgba(63,174,82,0.2)',
          padding: '16px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
        }}
      >
        <div style={{ color: '#3fae52', fontWeight: 800, letterSpacing: '0.12em' }}>PEAK FITNESS ATHLETICS</div>
        <div style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 700 }}>
          {(profile?.full_name || user?.email || 'Coach') + ' — ' + (teams.map((t) => t.name).join(', ') || 'No Team')}
        </div>
        <button
          onClick={signOut}
          style={{
            background: 'transparent',
            color: 'rgba(255,255,255,0.8)',
            border: '1px solid rgba(255,255,255,0.2)',
            padding: '8px 14px',
            borderRadius: '10px',
            cursor: 'pointer',
          }}
        >
          Sign Out
        </button>
      </header>

      <div style={{ display: 'flex', flex: 1 }}>
        <aside
          style={{
            width: '220px',
            background: '#0d1a0e',
            borderRight: '1px solid rgba(63,174,82,0.15)',
            paddingTop: '12px',
          }}
        >
          {navItems.map((item) => {
            const active = activeTab === item.key
            return (
              <div
                key={item.key}
                onClick={item.onClick}
                style={{
                  padding: '12px 20px',
                  color: active ? '#3fae52' : 'rgba(255,255,255,0.7)',
                  fontSize: '14px',
                  cursor: 'pointer',
                  borderLeft: active ? '3px solid #3fae52' : '3px solid transparent',
                  background: active ? 'rgba(63,174,82,0.08)' : 'transparent',
                }}
              >
                {item.label}
              </div>
            )
          })}
        </aside>

        <main style={{ flex: 1, padding: '32px', minHeight: 'calc(100vh - 80px)' }}>
          {selectedAthlete && selectedAthleteProfile ? (
            <div>
              <button
                onClick={() => setSelectedAthlete(null)}
                style={{
                  color: '#3fae52',
                  fontSize: '13px',
                  cursor: 'pointer',
                  marginBottom: '24px',
                  background: 'none',
                  border: 'none',
                  padding: 0,
                }}
              >
                ← Back to Roster
              </button>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '24px' }}>
                <div
                  style={{
                    width: '340px',
                    background: '#0d1a0e',
                    border: '1px solid rgba(63,174,82,0.2)',
                    borderRadius: '14px',
                    padding: '24px',
                    textAlign: 'center',
                  }}
                >
                  {selectedAthleteProfile.avatar_url ? (
                    <img
                      src={selectedAthleteProfile.avatar_url}
                      alt={selectedAthleteProfile.full_name}
                      style={{
                        width: '80px',
                        height: '80px',
                        borderRadius: '50%',
                        objectFit: 'cover',
                        border: '2px solid rgba(63,174,82,0.3)',
                        margin: '0 auto',
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: '80px',
                        height: '80px',
                        borderRadius: '50%',
                        background: 'rgba(63,174,82,0.15)',
                        color: '#3fae52',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto',
                        fontSize: '26px',
                        fontWeight: 800,
                      }}
                    >
                      {(selectedAthleteProfile.full_name || 'A')
                        .split(' ')
                        .map((n) => n[0].toUpperCase())
                        .join('')
                        .slice(0, 2)}
                    </div>
                  )}

                  <div style={{ color: '#fff', fontSize: '20px', fontWeight: 800, marginTop: '12px' }}>
                    {selectedAthleteProfile.full_name}
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>
                    {(selectedAthleteProfile.position || '—') + ' · ' + (selectedAthleteProfile.sport || '—')}
                  </div>
                  {selectedAthleteProfile.age_category && (
                    <div
                      style={{
                        display: 'inline-block',
                        marginTop: '8px',
                        padding: '4px 10px',
                        borderRadius: '999px',
                        background: 'rgba(63,174,82,0.12)',
                        color: '#3fae52',
                        fontSize: '11px',
                        fontWeight: 700,
                      }}
                    >
                      {selectedAthleteProfile.age_category}
                    </div>
                  )}

                  <div style={{ borderTop: '1px solid rgba(63,174,82,0.1)', margin: '16px 0' }} />

                  <div style={{ color: scoreColor(selectedAthleteScore?.overall_score), fontSize: '48px', fontWeight: 800 }}>
                    {typeof selectedAthleteScore?.overall_score === 'number'
                      ? selectedAthleteScore.overall_score
                      : '—'}
                  </div>
                  <div
                    style={{
                      color: 'rgba(255,255,255,0.4)',
                      fontSize: '10px',
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                    }}
                  >
                    Overall Score
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', marginTop: '8px' }}>
                    Last tested: {formatDate(lastTested[selectedAthlete])}
                  </div>
                  {(() => {
                    const trend = trendForAthlete(selectedAthlete)
                    if (!trend)
                      return (
                        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', marginTop: '8px' }}>
                          Trend: —
                        </div>
                      )
                    const color = trend === 'up' ? '#3fae52' : trend === 'down' ? '#ef4444' : 'rgba(255,255,255,0.6)'
                    const label = trend === 'up' ? 'Trending Up ↑' : trend === 'down' ? 'Declining ↓' : 'Stable →'
                    return (
                      <div style={{ color, fontSize: '12px', marginTop: '8px', fontWeight: 700 }}>
                        Trend: {label}
                      </div>
                    )
                  })()}
                </div>

                <div style={{ flex: 1 }}>
                  <div>
                    <div style={{ color: '#fff', fontSize: '15px', fontWeight: 700, marginBottom: '12px' }}>
                      Physical Profile
                    </div>
                    {['Speed', 'Power', 'Strength', 'Agility', 'Endurance'].map((cat) => {
                      const scoreVal = selectedAthleteScore?.[`${cat.toLowerCase()}_score`]
                      const pct = typeof scoreVal === 'number' ? Math.max(0, Math.min(100, scoreVal)) : 0
                      const color = typeof scoreVal !== 'number' ? 'rgba(255,255,255,0.25)' : pct >= 80 ? '#3fae52' : pct >= 60 ? '#f59e0b' : '#ef4444'
                      return (
                        <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                          <div style={{ width: '80px', color: 'rgba(255,255,255,0.6)', fontSize: '12px' }}>
                            {cat}
                          </div>
                          <div
                            style={{
                              flex: 1,
                              height: '6px',
                              borderRadius: '3px',
                              background: 'rgba(255,255,255,0.08)',
                              overflow: 'hidden',
                            }}
                          >
                            <div
                              style={{
                                width: `${pct}%`,
                                height: '100%',
                                borderRadius: '3px',
                                background: typeof scoreVal === 'number' ? color : 'transparent',
                                transition: 'width 0.3s ease',
                              }}
                            />
                          </div>
                          <div style={{ width: '32px', color, fontSize: '12px', textAlign: 'right', fontWeight: 700 }}>
                            {typeof scoreVal === 'number' ? Math.round(scoreVal) : '—'}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  <div style={{ marginTop: '24px' }}>
                    <div style={{ color: '#fff', fontSize: '15px', fontWeight: 700, marginBottom: '12px' }}>
                      Recent Results
                    </div>
                    {(!athleteResults || athleteResults.length === 0) && (
                      <div
                        style={{
                          color: 'rgba(255,255,255,0.4)',
                          fontSize: '12px',
                          padding: '20px 0',
                          textAlign: 'center',
                        }}
                      >
                        No test data recorded yet for this athlete.
                      </div>
                    )}

                    {athleteResults && athleteResults.length > 0 && (
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                          gap: '12px',
                        }}
                      >
                        {(() => {
                          const grouped = {}
                          athleteResults.forEach((r) => {
                            const cat = (r.category || 'Other').toUpperCase()
                            if (!grouped[cat]) grouped[cat] = []
                            grouped[cat].push(r)
                          })
                          return Object.entries(grouped).map(([cat, list]) => (
                            <div
                              key={cat}
                              style={{
                                background: '#0d1a0e',
                                border: '1px solid rgba(63,174,82,0.15)',
                                borderRadius: '12px',
                                padding: '12px',
                              }}
                            >
                              <div
                                style={{
                                  color: '#3fae52',
                                  fontWeight: 800,
                                  letterSpacing: '0.06em',
                                  fontSize: '12px',
                                  marginBottom: '8px',
                                }}
                              >
                                {cat}
                              </div>
                              <div className="space-y-2">
                                {list.map((r, idx) => (
                                  <div
                                    key={`${cat}-${idx}-${r.test_type}`}
                                    style={{
                                      padding: '8px 0',
                                      borderBottom: '1px solid rgba(255,255,255,0.06)',
                                    }}
                                  >
                                    <div
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        color: '#fff',
                                        fontSize: '13px',
                                        fontWeight: 600,
                                      }}
                                    >
                                      <span>{TEST_LABELS[r.test_type] || r.test_type}</span>
                                      <span style={{ color: '#3fae52', fontWeight: 700 }}>
                                        {formatResultValue(r.test_type, r.value)}
                                        {TEST_UNITS[r.test_type] ? TEST_UNITS[r.test_type] : ''}
                                      </span>
                                    </div>
                                    {STRENGTH_LOAD_TESTS.includes(r.test_type) && r.load_value && r.reps && (
                                      <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '10px', marginTop: '2px' }}>
                                        {r.load_value} × {r.reps} reps
                                      </div>
                                    )}
                                    {r.relative_strength && (
                                      <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '10px', marginTop: '1px' }}>
                                        {parseFloat(r.relative_strength).toFixed(1)}× BW
                                      </div>
                                    )}
                                    <div
                                      style={{
                                        color: 'rgba(255,255,255,0.3)',
                                        fontSize: '10px',
                                        marginTop: '4px',
                                      }}
                                    >
                                      {new Date(r.date_tested).toLocaleDateString()}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))
                        })()}
                      </div>
                    )}
                  </div>

                  {selectedAthleteGameStats && (
                    <div style={{ marginTop: '24px' }}>
                      <div style={{ color: '#fff', fontSize: '15px', fontWeight: 700, marginBottom: '12px' }}>
                        Game Stats
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          gap: '24px',
                          background: '#0d1a0e',
                          border: '1px solid rgba(63,174,82,0.15)',
                          borderRadius: '12px',
                          padding: '16px',
                        }}
                      >
                        {[
                          { label: 'Goals', value: selectedAthleteGameStats.goals },
                          { label: 'Assists', value: selectedAthleteGameStats.assists },
                          { label: 'Points', value: selectedAthleteGameStats.points },
                        ].map((stat) => (
                          <div key={stat.label} style={{ textAlign: 'center' }}>
                            <div style={{ color: '#fff', fontSize: '22px', fontWeight: 800 }}>
                              {stat.value ?? '—'}
                            </div>
                            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px' }}>
                              {stat.label}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {athleteBodyweight && athleteBodyweight.length > 0 && (
                    <div style={{ marginTop: '16px' }}>
                      <div style={{ color: '#fff', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>
                        Body Measurements
                      </div>
                      {athleteBodyweight.map((m, idx) => (
                        <div
                          key={idx}
                          style={{
                            display: 'flex',
                            gap: '16px',
                            fontSize: '11px',
                            color: 'rgba(255,255,255,0.6)',
                            padding: '4px 0',
                            borderBottom: '1px solid rgba(255,255,255,0.04)',
                          }}
                        >
                          <span>
                            {m.measurement_date
                              ? new Date(m.measurement_date).toLocaleDateString(undefined, {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })
                              : '—'}
                          </span>
                          <span>Weight: {m.weight != null ? `${m.weight} lbs` : '—'}</span>
                          <span>Body Fat: {m.body_fat_percentage != null ? `${m.body_fat_percentage}%` : '—'}</span>
                          <span>
                            Height:{' '}
                            {m.height != null
                              ? `${Math.floor(m.height / 12)}'${Math.round(m.height % 12)}"`
                              : '—'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <>
              {activeTab === 'roster' && (
                <div>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(5, 1fr)',
                      gap: '16px',
                      marginBottom: '16px',
                    }}
                  >
                    {/* Fastest */}
                    <div
                      style={{
                        background: '#0d1a0e',
                        border: '1px solid rgba(63,174,82,0.2)',
                        borderRadius: '12px',
                        padding: '20px',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ color: 'rgba(63,174,82,0.6)', fontSize: '10px', fontWeight: '700', letterSpacing: '0.1em' }}>
                        🏃 FASTEST PLAYER
                      </div>
                      <div style={{ color: 'white', fontSize: '18px', fontWeight: '700', margin: '8px 0 4px' }}>
                        {insights.fastest?.name || 'No sprint data yet'}
                      </div>
                      <div style={{ color: '#3fae52', fontSize: '13px' }}>
                        {insights.fastest?.value || ''}
                      </div>
                      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', marginTop: '4px' }}>
                        {insights.fastest?.position || ''}
                      </div>
                    </div>

                    {/* Most explosive */}
                    <div
                      style={{
                        background: '#0d1a0e',
                        border: '1px solid rgba(63,174,82,0.2)',
                        borderRadius: '12px',
                        padding: '20px',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ color: 'rgba(245,158,11,0.8)', fontSize: '10px', fontWeight: '700', letterSpacing: '0.1em' }}>
                        ⚡ MOST EXPLOSIVE
                      </div>
                      <div style={{ color: 'white', fontSize: '18px', fontWeight: '700', margin: '8px 0 4px' }}>
                        {insights.mostExplosive?.name || 'No power data yet'}
                      </div>
                      <div style={{ color: '#f59e0b', fontSize: '13px' }}>
                        {insights.mostExplosive?.value || ''}
                      </div>
                      {((insights.mostExplosive?.vertJump && !isNaN(insights.mostExplosive.vertJump)) ||
                        (insights.mostExplosive?.broadJump && !isNaN(insights.mostExplosive.broadJump))) && (
                        <div style={{ marginTop: '6px', display: 'grid', gap: '6px' }}>
                          {insights.mostExplosive?.vertJump && !isNaN(insights.mostExplosive.vertJump) && (
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                color: 'rgba(255,255,255,0.6)',
                                fontSize: '10px',
                              }}
                            >
                              <span style={{ color: 'rgba(255,255,255,0.75)' }}>Vertical Jump</span>
                              <span style={{ textAlign: 'right', color: '#f59e0b', fontWeight: 700 }}>
                                {insights.mostExplosive.vertJump} cm
                              </span>
                            </div>
                          )}
                          {insights.mostExplosive?.broadJump && !isNaN(insights.mostExplosive.broadJump) && (
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                color: 'rgba(255,255,255,0.6)',
                                fontSize: '10px',
                              }}
                            >
                              <span style={{ color: 'rgba(255,255,255,0.75)' }}>Broad Jump</span>
                              <span style={{ textAlign: 'right', color: '#f59e0b', fontWeight: 700 }}>
                                {insights.mostExplosive.broadJump} m
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', marginTop: '4px' }}>
                        {insights.mostExplosive?.position || ''}
                      </div>
                    </div>

                    {/* Strongest */}
                    <div
                      style={{
                        background: '#0d1a0e',
                        border: '1px solid rgba(63,174,82,0.2)',
                        borderRadius: '12px',
                        padding: '20px',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ color: 'rgba(239,68,68,0.8)', fontSize: '10px', fontWeight: '700', letterSpacing: '0.1em' }}>
                        💪 STRONGEST
                      </div>
                      <div style={{ color: 'white', fontSize: '18px', fontWeight: '700', margin: '8px 0 4px' }}>
                        {insights.strongest?.name || 'No strength data yet'}
                      </div>
                      <div style={{ color: '#ef4444', fontSize: '13px' }}>
                        {insights.strongest?.value || ''}
                      </div>
                      {insights.strongest?.lifts?.length > 0 && (
                        <div style={{ marginTop: '6px', display: 'grid', gap: '4px' }}>
                          {insights.strongest.lifts.map((lift) => (
                            <div
                              key={lift.testType}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                color: 'rgba(255,255,255,0.6)',
                                fontSize: '10px',
                              }}
                            >
                              <span style={{ color: 'rgba(255,255,255,0.75)' }}>
                                {lift.testType === 'bench_press'
                                  ? 'Bench'
                                  : lift.testType === 'trap_bar_deadlift'
                                  ? 'Trap Bar DL'
                                  : TEST_LABELS[lift.testType] || lift.testType}
                              </span>
                              <span style={{ textAlign: 'right' }}>
                                {lift.load} × {lift.reps}
                              </span>
                              <span style={{ textAlign: 'right', color: '#ef4444', fontWeight: 700 }}>
                                {Math.round(lift.e1rm)} lbs
                              </span>
                              {lift.relative_strength && (
                                <span style={{ textAlign: 'right', color: 'rgba(255,255,255,0.65)' }}>
                                  {parseFloat(lift.relative_strength).toFixed(1)}× BW
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', marginTop: '4px' }}>
                        {insights.strongest?.position || ''}
                      </div>
                    </div>

                    {/* Conditioning */}
                    <div
                      style={{
                        background: '#0d1a0e',
                        border: '1px solid rgba(63,174,82,0.2)',
                        borderRadius: '12px',
                        padding: '20px',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ color: 'rgba(6,182,212,0.8)', fontSize: '10px', fontWeight: '700', letterSpacing: '0.1em' }}>
                        🫁 CONDITIONING
                      </div>
                      <div style={{ color: 'white', fontSize: '18px', fontWeight: '700', margin: '8px 0 4px' }}>
                        {insights.conditioning?.name || 'No beep test data yet'}
                      </div>
                      <div style={{ color: '#06b6d4', fontSize: '13px' }}>
                        {insights.conditioning?.value || ''}
                      </div>
                      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', marginTop: '4px' }}>
                        {insights.conditioning?.position || ''}
                      </div>
                    </div>

                    {/* Most Agile */}
                    <div
                      style={{
                        background: '#0d1a0e',
                        border: '1px solid rgba(139,92,246,0.25)',
                        borderRadius: '12px',
                        padding: '20px',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ color: 'rgba(139,92,246,0.8)', fontSize: '10px', fontWeight: '700', letterSpacing: '0.1em' }}>
                        🔀 MOST AGILE
                      </div>
                      <div style={{ color: 'white', fontSize: '18px', fontWeight: '700', margin: '8px 0 4px' }}>
                        {insights.mostAgile?.name || 'No agility data yet'}
                      </div>
                      <div style={{ color: '#8b5cf6', fontSize: '13px' }}>
                        {insights.mostAgile?.value || ''}
                      </div>
                      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', marginTop: '4px' }}>
                        {insights.mostAgile?.position || ''}
                      </div>
                    </div>
                  </div>

                  {(coachInsightsLoading || coachInsights) && (
                    <div style={{ marginBottom: '24px', background: '#0d1a0e', border: '1px solid rgba(63,174,82,0.2)', borderRadius: '12px', padding: '24px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                        <div>
                          <div style={{ color: '#3fae52', fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '4px' }}>
                            Coach Intelligence Briefing
                          </div>
                          {coachInsightsDate && (
                            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px' }}>
                              Based on test session: {new Date(coachInsightsDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                            </div>
                          )}
                        </div>
                        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', fontStyle: 'italic' }}>AI-assisted · confirm with your eyes</div>
                      </div>

                      {coachInsightsLoading && (
                        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', fontStyle: 'italic' }}>Generating team briefing...</div>
                      )}

                      {coachInsights && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                          {coachInsights.team_pulse && (
                            <div>
                              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '6px' }}>Team Pulse</div>
                              <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '13px', lineHeight: 1.7, margin: 0 }}>{coachInsights.team_pulse}</p>
                            </div>
                          )}
                          {coachInsights.data_flags && (
                            <div style={{ borderLeft: '3px solid #f59e0b', paddingLeft: '14px' }}>
                              <div style={{ color: '#f59e0b', fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '6px' }}>Data Flags — Confirm With Your Eyes</div>
                              <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '13px', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-line' }}>{coachInsights.data_flags}</p>
                            </div>
                          )}
                          {coachInsights.testing_gaps && (
                            <div style={{ borderLeft: '3px solid rgba(239,68,68,0.6)', paddingLeft: '14px' }}>
                              <div style={{ color: '#ef4444', fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '6px' }}>Testing Gaps</div>
                              <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '13px', lineHeight: 1.7, margin: 0 }}>{coachInsights.testing_gaps}</p>
                            </div>
                          )}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            {coachInsights.collective_strength && (
                              <div style={{ background: 'rgba(63,174,82,0.06)', border: '1px solid rgba(63,174,82,0.15)', borderRadius: '8px', padding: '14px' }}>
                                <div style={{ color: '#3fae52', fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '6px' }}>Collective Strength</div>
                                <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '13px', lineHeight: 1.6, margin: 0 }}>{coachInsights.collective_strength}</p>
                              </div>
                            )}
                            {coachInsights.collective_gap && (
                              <div style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: '8px', padding: '14px' }}>
                                <div style={{ color: '#ef4444', fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '6px' }}>Collective Gap</div>
                                <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '13px', lineHeight: 1.6, margin: 0 }}>{coachInsights.collective_gap}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {roster.length > 0 && (() => {
                    const categories = ['speed', 'strength', 'power', 'agility', 'endurance']
                    const categoryLabels = ['Speed', 'Strength', 'Power', 'Agility', 'Endurance']
                    const categoryColors = {
                      speed: '#3fae52',
                      strength: '#ef4444',
                      power: '#f59e0b',
                      agility: '#8b5cf6',
                      endurance: '#06b6d4',
                    }

                    const getCellColor = (score) => {
                      if (score == null || score === 0) return { bg: 'rgba(255,255,255,0.04)', text: 'rgba(255,255,255,0.2)', label: '—' }
                      if (score >= 70) return { bg: 'rgba(63,174,82,0.25)', text: '#3fae52', label: score }
                      if (score >= 50) return { bg: 'rgba(245,158,11,0.2)', text: '#f59e0b', label: score }
                      return { bg: 'rgba(239,68,68,0.18)', text: '#ef4444', label: score }
                    }

                    return (
                      <div style={{ marginBottom: '24px', background: '#0d1a0e', border: '1px solid rgba(63,174,82,0.15)', borderRadius: '12px', padding: '20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                          <div style={{ color: '#fff', fontSize: '15px', fontWeight: 700 }}>Roster Development Grid</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '11px' }}>
                            <span style={{ color: '#3fae52' }}>■ Strong (70+)</span>
                            <span style={{ color: '#f59e0b' }}>■ Average (50–69)</span>
                            <span style={{ color: '#ef4444' }}>■ Developing (&lt;50)</span>
                            <span style={{ color: 'rgba(255,255,255,0.2)' }}>■ No data</span>
                          </div>
                        </div>

                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '480px' }}>
                            <thead>
                              <tr>
                                <th style={{ textAlign: 'left', padding: '6px 12px 10px 0', color: 'rgba(255,255,255,0.4)', fontSize: '11px', fontWeight: 600, width: '140px' }}>Athlete</th>
                                {categoryLabels.map((label, i) => (
                                  <th key={label} style={{ textAlign: 'center', padding: '6px 4px 10px', color: categoryColors[categories[i]], fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                                    {label}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {filteredRoster.map((ath) => {
                                const s = scores[ath.id]
                                const firstName = (ath.full_name || '').split(' ')[0]
                                const lastName = (ath.full_name || '').split(' ').slice(1).join(' ')
                                return (
                                  <tr key={ath.id} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                                    <td style={{ padding: '8px 12px 8px 0', fontSize: '12px', color: '#fff', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                      {firstName} <span style={{ color: 'rgba(255,255,255,0.45)', fontWeight: 400 }}>{lastName}</span>
                                    </td>
                                    {categories.map((cat) => {
                                      const score = s?.[`${cat}_score`] != null ? Math.round(s[`${cat}_score`]) : null
                                      const cell = getCellColor(score)
                                      return (
                                        <td key={cat} style={{ padding: '4px', textAlign: 'center' }}>
                                          <div style={{ background: cell.bg, color: cell.text, fontSize: '12px', fontWeight: 700, borderRadius: '6px', padding: '6px 4px', minWidth: '40px' }}>
                                            {cell.label}
                                          </div>
                                        </td>
                                      )
                                    })}
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )
                  })()}

                  {needsTesting.length > 0 && (
                    <div
                      style={{
                        background: 'rgba(245,158,11,0.08)',
                        border: '1px solid rgba(245,158,11,0.2)',
                        borderRadius: '10px',
                        padding: '12px 20px',
                        marginBottom: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '16px',
                      }}
                    >
                      <div
                        style={{
                          color: '#f59e0b',
                          fontSize: '11px',
                          fontWeight: 700,
                          letterSpacing: '0.1em',
                        }}
                      >
                        ⚠️ NEEDS TESTING
                      </div>
                      <div
                        style={{
                          color: 'rgba(255,255,255,0.6)',
                          fontSize: '12px',
                          flex: 1,
                        }}
                      >
                        {(() => {
                          const display = needsTesting.slice(0, 5).map((a) => a.full_name)
                          const more = needsTesting.length - display.length
                          return display.join(' · ') + (more > 0 ? ` · +${more} more` : '')
                        })()}
                      </div>
                      <div
                        style={{
                          color: 'rgba(255,255,255,0.7)',
                          fontSize: '12px',
                          display: 'flex',
                          gap: '10px',
                        }}
                      >
                        <span style={{ color: '#ef4444' }}>
                          {needsTesting.filter((ath) => {
                            const lastDate = lastTested[ath.id]
                            if (!lastDate) return true
                            const daysAgo = Math.floor((Date.now() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24))
                            return daysAgo > 90
                          }).length}{' '}
                          critical
                        </span>
                        <span style={{ color: '#f59e0b' }}>
                          {needsTesting.filter((ath) => {
                            const lastDate = lastTested[ath.id]
                            if (!lastDate) return false
                            const daysAgo = Math.floor((Date.now() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24))
                            return daysAgo > 60 && daysAgo <= 90
                          }).length}{' '}
                          overdue
                        </span>
                      </div>
                    </div>
                  )}

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '16px',
                    }}
                  >
                    <div style={{ color: '#fff', fontSize: '20px', fontWeight: 700 }}>
                      Roster
                    </div>
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search athlete..."
                      style={{
                        width: '240px',
                        background: '#0d1a0e',
                        border: '1px solid rgba(63,174,82,0.2)',
                        borderRadius: '10px',
                        padding: '10px 12px',
                        color: '#fff',
                      }}
                    />
                  </div>

                  {!teams.length ? (
                    <div
                      style={{
                        color: 'rgba(255,255,255,0.5)',
                        textAlign: 'center',
                        padding: '24px 0',
                      }}
                    >
                      No team assigned. Contact admin.
                    </div>
                  ) : !roster.length ? (
                    <div
                      style={{
                        color: 'rgba(255,255,255,0.5)',
                        textAlign: 'center',
                        padding: '24px 0',
                      }}
                    >
                      No athletes on your roster yet.
                    </div>
                  ) : (
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                        gap: '16px',
                      }}
                    >
                      {filteredRoster.map((ath) => {
                        const scoreEntry = scores[ath.id]
                        const last = lastTested[ath.id]
                        const daysAgo = getDaysAgo(last)
                        const trend = trendForAthlete(ath.id)
                        const overallScore = scoreEntry?.overall_score
                        const scoreDisplay = typeof overallScore === 'number' ? overallScore : '—'
                        return (
                          <div
                            key={ath.id}
                            onClick={() => {
                              setSelectedAthlete(ath.id)
                              console.log('Selected athlete', ath.id)
                            }}
                            style={{
                              background: '#0d1a0e',
                              border: '1px solid rgba(63,174,82,0.15)',
                              borderRadius: '12px',
                              cursor: 'pointer',
                              overflow: 'hidden',
                              transition: 'border-color 0.2s ease',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.borderColor = 'rgba(63,174,82,0.4)'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.borderColor = 'rgba(63,174,82,0.15)'
                            }}
                          >
                            <div style={{ padding: '16px', textAlign: 'center' }}>
                              {ath.avatar_url ? (
                                <img
                                  src={ath.avatar_url}
                                  alt={ath.full_name}
                                  style={{
                                    width: '56px',
                                    height: '56px',
                                    borderRadius: '50%',
                                    objectFit: 'cover',
                                    border: '2px solid rgba(63,174,82,0.3)',
                                    margin: '0 auto',
                                  }}
                                />
                              ) : (
                                <div
                                  style={{
                                    width: '56px',
                                    height: '56px',
                                    borderRadius: '50%',
                                    background: 'rgba(63,174,82,0.15)',
                                    color: '#3fae52',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    margin: '0 auto',
                                    fontSize: '18px',
                                    fontWeight: 700,
                                  }}
                                >
                                  {(ath.full_name || 'A')
                                    .split(' ')
                                    .map((n) => n[0].toUpperCase())
                                    .join('')
                                    .slice(0, 2)}
                                </div>
                              )}
                              <div
                                style={{
                                  color: '#fff',
                                  fontSize: '14px',
                                  fontWeight: 700,
                                  marginTop: '8px',
                                }}
                              >
                                {ath.full_name || 'Unknown'}
                              </div>
                              <div
                                style={{
                                  color: 'rgba(255,255,255,0.5)',
                                  fontSize: '11px',
                                  marginTop: '4px',
                                }}
                              >
                                {(ath.position || '—') + ' · ' + (ath.sport || '—')}
                              </div>
                            </div>

                            <div
                              style={{
                                borderTop: '1px solid rgba(255,255,255,0.06)',
                                padding: '12px 16px',
                                textAlign: 'center',
                              }}
                            >
                              <div
                                style={{
                                  color: scoreColor(overallScore),
                                  fontSize: '28px',
                                  fontWeight: 800,
                                }}
                              >
                                {scoreDisplay}
                              </div>
                              <div
                                style={{
                                  color: 'rgba(255,255,255,0.4)',
                                  fontSize: '10px',
                                  letterSpacing: '0.08em',
                                  textTransform: 'uppercase',
                                }}
                              >
                                Overall Score
                              </div>
                            </div>

                            <div
                              style={{
                                padding: '0 16px 12px',
                                display: 'flex',
                                gap: '6px',
                                flexWrap: 'wrap',
                              }}
                            >
                              <div
                                style={{
                                  fontSize: '10px',
                                  padding: '6px 8px',
                                  borderRadius: '999px',
                                  background:
                                    daysAgo == null
                                      ? 'rgba(239,68,68,0.15)'
                                      : daysAgo > 90
                                      ? 'rgba(239,68,68,0.15)'
                                      : daysAgo > 60
                                      ? 'rgba(245,158,11,0.15)'
                                      : 'rgba(63,174,82,0.1)',
                                  color:
                                    daysAgo == null
                                      ? '#ef4444'
                                      : daysAgo > 90
                                      ? '#ef4444'
                                      : daysAgo > 60
                                      ? '#f59e0b'
                                      : 'rgba(63,174,82,0.7)',
                                }}
                              >
                                {daysAgo == null
                                  ? 'Never tested'
                                  : daysAgo === 0
                                  ? 'Today'
                                  : daysAgo === 1
                                  ? '1 day ago'
                                  : daysAgo > 90
                                  ? '90+ days ago'
                                  : daysAgo > 60
                                  ? '60+ days ago'
                                  : `${daysAgo} days ago`}
                              </div>

                              {trend && (
                                <div
                                  style={{
                                    fontSize: '10px',
                                    padding: '6px 8px',
                                    borderRadius: '999px',
                                    background:
                                      trend === 'up'
                                        ? 'rgba(63,174,82,0.1)'
                                        : trend === 'down'
                                        ? 'rgba(239,68,68,0.1)'
                                        : 'rgba(255,255,255,0.05)',
                                    color:
                                      trend === 'up'
                                        ? '#3fae52'
                                        : trend === 'down'
                                        ? '#ef4444'
                                        : 'rgba(255,255,255,0.6)',
                                  }}
                                >
                                  {trend === 'up' ? 'Trending up ↑' : trend === 'down' ? 'Trending down ↓' : 'Flat →'}
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  <div
                    style={{
                      borderTop: '1px solid rgba(63,174,82,0.2)',
                      marginTop: '40px',
                      paddingTop: '32px',
                    }}
                  >
                    <div
                      style={{
                        color: 'white',
                        fontSize: '20px',
                        fontWeight: '700',
                        marginBottom: '24px',
                      }}
                    >
                      Team Test History
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        gap: '12px',
                        marginBottom: '24px',
                        flexWrap: 'wrap',
                      }}
                    >
                      <input
                        value={historySearch}
                        onChange={(e) => setHistorySearch(e.target.value)}
                        placeholder="Search athlete..."
                        style={{
                          flex: '1 1 240px',
                          minWidth: '220px',
                          background: '#0d1a0e',
                          border: '1px solid rgba(63,174,82,0.2)',
                          borderRadius: '10px',
                          padding: '10px 12px',
                          color: '#fff',
                        }}
                      />
                      <select
                        value={historyCategory}
                        onChange={(e) => setHistoryCategory(e.target.value)}
                        style={{
                          flex: '0 0 200px',
                          background: '#0d1a0e',
                          border: '1px solid rgba(63,174,82,0.2)',
                          borderRadius: '10px',
                          padding: '10px 12px',
                          color: '#fff',
                        }}
                      >
                        {['All', 'Speed', 'Power', 'Strength', 'Agility', 'Endurance'].map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>

                    {(() => {
                      if (!allResultsState || allResultsState.length === 0) {
                        return (
                          <div
                            style={{
                              color: 'rgba(255,255,255,0.5)',
                              textAlign: 'center',
                              padding: '40px 0',
                            }}
                          >
                            No test sessions recorded for this team yet.
                          </div>
                        )
                      }

                      const grouped = {}
                      ;(allResultsState || []).forEach((r) => {
                        const dateOnly = new Date(r.date_tested).toISOString().split('T')[0]
                        if (!grouped[dateOnly]) grouped[dateOnly] = []
                        grouped[dateOnly].push(r)
                      })

                      const sortedDates = Object.keys(grouped).sort((a, b) => new Date(b) - new Date(a))

                      return sortedDates.map((dateStr) => {
                        const entries = grouped[dateStr] || []
                        const uniqueAthletes = new Set(entries.map((i) => i.athlete_id)).size
                        const uniqueCategories = Array.from(
                          new Set(entries.map((i) => (i.category || '').toUpperCase()).filter(Boolean))
                        )
                        const totalResults = entries.length

                        const resultsByCategory = {}
                        entries.forEach((item) => {
                          const cat = (item.category || 'UNKNOWN').toUpperCase()
                          if (!resultsByCategory[cat]) resultsByCategory[cat] = {}
                          if (!resultsByCategory[cat][item.test_type]) resultsByCategory[cat][item.test_type] = []
                          resultsByCategory[cat][item.test_type].push(item)
                        })

                        const expanded = !!expandedHistoryDates[dateStr]
                        const formattedDate = new Date(dateStr).toLocaleDateString(undefined, {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })

                        return (
                          <div key={dateStr} style={{ marginBottom: '8px' }}>
                            <div
                              onClick={() =>
                                setExpandedHistoryDates((prev) => ({ ...prev, [dateStr]: !prev[dateStr] }))
                              }
                              style={{
                                background: '#0d1a0e',
                                border: '1px solid rgba(63,174,82,0.15)',
                                borderRadius: '10px',
                                padding: '14px 18px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                cursor: 'pointer',
                                borderLeft: expanded ? '3px solid #3fae52' : '1px solid rgba(63,174,82,0.15)',
                              }}
                            >
                              <div style={{ color: '#fff', fontWeight: 600 }}>{formattedDate}</div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', justifyContent: 'center' }}>
                                {uniqueCategories.map((cat) => {
                                  const color = DASH_CATEGORY_COLORS[cat] || '#3fae52'
                                  return (
                                    <span
                                      key={`${dateStr}-${cat}`}
                                      style={{
                                        fontSize: '10px',
                                        fontWeight: 700,
                                        padding: '3px 8px',
                                        borderRadius: '12px',
                                        background: `${color}26`,
                                        color,
                                        letterSpacing: '0.05em',
                                      }}
                                    >
                                      {cat}
                                    </span>
                                  )
                                })}
                              </div>
                              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span>
                                  {uniqueAthletes} athletes · {totalResults} results
                                </span>
                                <span style={{ color: '#3fae52' }}>{expanded ? '▲' : '▼'}</span>
                              </div>
                            </div>

                            {expanded && (
                              <div
                                style={{
                                  display: 'grid',
                                  gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                                  gap: '12px',
                                  padding: '12px 0 16px',
                                }}
                              >
                                {Object.entries(resultsByCategory)
                                  .filter(([cat]) => historyCategory === 'All' || cat === historyCategory.toUpperCase())
                                  .map(([cat, tests]) => {
                                    const testEntries = Object.entries(tests)
                                    if (testEntries.length === 0) return null
                                    const color = DASH_CATEGORY_COLORS[cat] || '#3fae52'
                                    const totalTests = testEntries.length
                                    const athleteIds = new Set()
                                    testEntries.forEach(([, list]) => list.forEach((item) => athleteIds.add(item.athlete_id)))
                                    return (
                                      <div
                                        key={`${dateStr}-${cat}`}
                                        style={{
                                          background: '#0a0f0a',
                                          border: '1px solid rgba(63,174,82,0.1)',
                                          borderRadius: '10px',
                                          padding: '14px',
                                        }}
                                      >
                                        <div
                                          style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            marginBottom: '10px',
                                          }}
                                        >
                                          <div
                                            style={{
                                              color,
                                              fontWeight: 700,
                                              fontSize: '12px',
                                              letterSpacing: '0.08em',
                                            }}
                                          >
                                            {cat}
                                          </div>
                                          <div
                                            style={{
                                              fontSize: '11px',
                                              color: 'rgba(255,255,255,0.6)',
                                              background: 'rgba(255,255,255,0.05)',
                                              padding: '4px 8px',
                                              borderRadius: '999px',
                                            }}
                                          >
                                            {totalTests} tests · {athleteIds.size} athletes
                                          </div>
                                        </div>

                                        {testEntries.map(([testType, list]) => {
                                          const label = DASH_TEST_LABELS[testType] || testType
                                          const unit = DASH_TEST_UNITS[testType] || ''
                                          return (
                                            <div key={`${dateStr}-${cat}-${testType}`} style={{ marginTop: '8px' }}>
                                              <div
                                                style={{
                                                  color: 'rgba(255,255,255,0.7)',
                                                  fontSize: '12px',
                                                  fontWeight: 600,
                                                  marginBottom: '6px',
                                                }}
                                              >
                                                {label}
                                              </div>
                                              <div>
                                                {list.map((item, idx) => {
                                                  const name = getAthleteName(item.athlete_id)
                                                  const matches = historySearch
                                                    ? name?.toLowerCase().includes(historySearch.toLowerCase())
                                                    : true
                                                  const shouldDim = historySearch && !matches
                                                  return (
                                                    <div
                                                      key={`${dateStr}-${cat}-${testType}-${idx}`}
                                                      style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between',
                                                        padding: '4px 0',
                                                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                                                        background:
                                                          historySearch && matches ? 'rgba(63,174,82,0.08)' : 'transparent',
                                                        opacity: shouldDim ? 0.3 : 1,
                                                      }}
                                                    >
                                                      <div
                                                        style={{
                                                          color: '#fff',
                                                          fontSize: '12px',
                                                          fontWeight: 500,
                                                        }}
                                                      >
                                                        {name}
                                                      </div>
                                                      {STRENGTH_LOAD_TESTS.includes(testType) ? (
                                                        <div style={{ textAlign: 'right' }}>
                                                          <div style={{ color: '#3fae52', fontSize: '12px', fontWeight: '700' }}>
                                                            {Math.round(item.value)} lbs
                                                          </div>
                                                          {item.load_value && item.reps && (
                                                            <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '10px', marginTop: '2px' }}>
                                                              {item.load_value} × {item.reps} reps
                                                            </div>
                                                          )}
                                                          {item.relative_strength && (
                                                            <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '10px', marginTop: '1px' }}>
                                                              {parseFloat(item.relative_strength).toFixed(1)}× BW
                                                            </div>
                                                          )}
                                                        </div>
                                                      ) : (
                                                        <div
                                                          style={{
                                                            textAlign: 'right',
                                                          }}
                                                        >
                                                          <div
                                                            style={{
                                                              color: '#3fae52',
                                                              fontSize: '12px',
                                                              fontWeight: '700',
                                                            }}
                                                          >
                                                            {formatResultValue(testType, item.value)}{unit}
                                                          </div>
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
                                    )
                                  })}
                              </div>
                            )}
                          </div>
                        )
                      })
                    })()}
                  </div>
                </div>
              )}

              {activeTab === 'leaderboards' && (
                <div>
                  <div
                    style={{
                      color: '#fff',
                      fontSize: '20px',
                      fontWeight: '700',
                      marginBottom: '12px',
                    }}
                  >
                    Leaderboards
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '8px',
                      marginBottom: '16px',
                    }}
                  >
                    {['All', 'Speed', 'Power', 'Strength', 'Agility', 'Endurance', 'Conditioning'].map((cat) => {
                      const active = leaderboardCategory === cat
                      return (
                        <button
                          key={cat}
                          onClick={() => setLeaderboardCategory(cat)}
                          style={{
                            border: 'none',
                            cursor: 'pointer',
                            padding: '6px 16px',
                            borderRadius: '20px',
                            fontSize: '12px',
                            fontWeight: active ? 700 : 600,
                            background: active ? '#3fae52' : 'rgba(63,174,82,0.1)',
                            color: active ? '#000' : 'rgba(255,255,255,0.6)',
                            marginRight: '8px',
                          }}
                        >
                          {cat}
                        </button>
                      )
                    })}
                  </div>

                  {(() => {
                    const effectiveCategory = leaderboardCategory === 'All' ? 'Speed' : leaderboardCategory
                    const data = buildLeaderboards(effectiveCategory)
                    const tests =
                      leaderboardCategory === 'All'
                        ? Object.keys(CATEGORY_TESTS).flatMap((c) => CATEGORY_TESTS[c])
                        : CATEGORY_TESTS[effectiveCategory] || []
                    const hasAny = tests.some((t) => (data[t] || []).length > 0)

                    if (!hasAny) {
                      return (
                        <div
                          style={{
                            color: 'rgba(255,255,255,0.3)',
                            fontSize: '14px',
                            padding: '60px 0',
                            textAlign: 'center',
                          }}
                        >
                          No {effectiveCategory} data recorded for this team yet.
                        </div>
                      )
                    }

                    return (
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                          gap: '16px',
                        }}
                      >
                        {tests
                          .filter((t) => (data[t] || []).length > 0)
                          .map((test) => (
                            <div
                              key={test}
                              style={{
                                background: '#0d1a0e',
                                border: '1px solid rgba(63,174,82,0.15)',
                                borderRadius: '12px',
                                padding: '16px',
                              }}
                            >
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  marginBottom: '8px',
                                }}
                              >
                                <div
                                  style={{
                                    color: '#fff',
                                    fontSize: '15px',
                                    fontWeight: 700,
                                  }}
                                >
                                  {TEST_LABELS[test] || test}
                                </div>
                                <div
                                  style={{
                                    color: 'rgba(255,255,255,0.5)',
                                    fontSize: '12px',
                                  }}
                                >
                                  {TEST_UNITS[test] || ''}
                                </div>
                              </div>

                              {(data[test] || []).length === 0 ? (
                                <div
                                  style={{
                                    color: 'rgba(255,255,255,0.5)',
                                    fontSize: '12px',
                                    padding: '16px 0',
                                  }}
                                >
                                  No data recorded yet
                                </div>
                              ) : (
                                (data[test] || []).map((entry, idx) => {
                                  const rank = idx + 1
                                  const rankColor = rank === 1 ? '#FFD700' : rank === 2 ? '#C0C0C0' : rank === 3 ? '#CD7F32' : 'rgba(255,255,255,0.3)'
                                  const leftBorder =
                                    rank === 1 ? '3px solid #FFD700' : rank === 2 ? '3px solid #C0C0C0' : rank === 3 ? '3px solid #CD7F32' : '3px solid transparent'
                                  return (
                                    <div
                                      key={entry.athleteId}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        padding: '8px 0',
                                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                                        paddingLeft: leftBorder !== '3px solid transparent' ? '8px' : 0,
                                        borderLeft: leftBorder,
                                      }}
                                    >
                                      <div
                                        style={{
                                          width: '24px',
                                          color: rankColor,
                                          fontSize: '13px',
                                          fontWeight: 700,
                                        }}
                                      >
                                        {rank}
                                      </div>
                                      <div style={{ flex: 1 }}>
                                        <div
                                          style={{
                                            color: '#fff',
                                            fontSize: '13px',
                                            fontWeight: 600,
                                          }}
                                        >
                                          {entry.name}
                                        </div>
                                        <div
                                          style={{
                                            color: 'rgba(255,255,255,0.4)',
                                            fontSize: '11px',
                                            marginRight: '8px',
                                          }}
                                        >
                                          {entry.position}
                                        </div>
                                      </div>
                                      <div
                                        style={{
                                          color: '#3fae52',
                                          fontSize: '13px',
                                          fontWeight: 700,
                                          textAlign: 'right',
                                        }}
                                      >
                                        {STRENGTH_LOAD_TESTS.includes(test)
                                          ? `${Math.round(entry.value)} lbs`
                                          : `${entry.value} ${TEST_UNITS[test] || ''}`}
                                      </div>
                                    </div>
                                  )
                                })
                              )}
                            </div>
                          ))}
                      </div>
                    )
                  })()}
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  )
}

export default Dashboard
