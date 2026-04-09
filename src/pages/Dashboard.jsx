import React, { useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import useAuth from '../hooks/useAuth'
import { supabase } from '../services/supabase'

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
    needsTesting: { criticalCount: 0, warningCount: 0, names: [] },
  })
  const [selectedAthlete, setSelectedAthlete] = useState(null)
  const [athleteResults, setAthleteResults] = useState([])
  const [allResultsState, setAllResultsState] = useState([])
  const [gameStatsState, setGameStatsState] = useState([])
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!profile?.id) return
    loadData()
  }, [profile?.id])

  useEffect(() => {
    const fetchAthleteResults = async () => {
      if (!selectedAthlete) return
      try {
        const { data } = await supabase
          .from('pfa_test_results')
          .select('test_type, value, date_tested, category')
          .eq('athlete_id', selectedAthlete)
          .order('date_tested', { ascending: false })
          .limit(20)
        setAthleteResults(data || [])
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
          .select('athlete_id, overall_score, calculated_at')
          .in('athlete_id', athleteIds)
          .order('calculated_at', { ascending: false })
        if (error) console.warn('[Dashboard] query failed: composite scores', error.message)
        else scoreData = data || []
      } catch (e) {
        console.warn('[Dashboard] query exception: composite scores', e)
      }

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
      try {
        const { data, error } = await supabase
          .from('pfa_test_results')
          .select('athlete_id, test_type, value, date_tested')
          .in('athlete_id', athleteIds)
          .order('date_tested', { ascending: false })
        if (error) console.warn('[Dashboard] query failed: all results', error.message)
        else allResults = data || []
      } catch (e) {
        console.warn('[Dashboard] query exception: all results', e)
      }

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

      let strengthCatScores = []
      try {
        const { data, error } = await supabase
          .from('pfa_composite_scores')
          .select('athlete_id, strength_score, calculated_at')
          .in('athlete_id', athleteIds)
          .order('calculated_at', { ascending: false })
        if (error) console.warn('[Dashboard] query failed: strength scores', error.message)
        else strengthCatScores = data || []
      } catch (e) {
        console.warn('[Dashboard] query exception: strength scores', e)
      }

      const latestScores = {}
      const history = {}
      ;(scoreData || []).forEach((s) => {
        if (!latestScores[s.athlete_id]) latestScores[s.athlete_id] = s
        if (!history[s.athlete_id]) history[s.athlete_id] = []
        history[s.athlete_id].push(s.overall_score)
      })
      const latestTested = {}
      ;(lastData || []).forEach((l) => {
        if (!latestTested[l.athlete_id]) latestTested[l.athlete_id] = l.date_tested
      })

      setScores(latestScores)
      setLastTested(latestTested)
      setScoreHistory(history)
      setAllResultsState(allResults || [])
      setGameStatsState(gameStats || [])

      // Insights calculations
      const fastest = (() => {
        const sprintResults = (allResults || []).filter((r) => r.test_type === '10m_sprint')
        const bestSprintPerAthlete = {}
        for (const r of sprintResults) {
          const current = bestSprintPerAthlete[r.athlete_id]
          if (!current || r.value < current.value) {
            bestSprintPerAthlete[r.athlete_id] = r
          }
        }
        const fastestEntry = Object.values(bestSprintPerAthlete).sort((a, b) => a.value - b.value)[0]
        const fastestProfile = fastestEntry ? roster.find((r) => r.id === fastestEntry.athlete_id) : null

        return fastestEntry && fastestProfile
          ? {
              athleteName: fastestProfile.full_name,
              value: `${fastestEntry.value}s (10m sprint)`,
              position: fastestProfile.position,
            }
          : null
      })()

      const mostAgile = (() => {
        const agilityResults = (allResults || []).filter((r) => r.test_type === 'pro_agility_shuttle')
        const bestAgilityPerAthlete = {}
        for (const r of agilityResults) {
          const current = bestAgilityPerAthlete[r.athlete_id]
          if (!current || r.value < current.value) {
            bestAgilityPerAthlete[r.athlete_id] = r
          }
        }
        const mostAgileEntry = Object.values(bestAgilityPerAthlete).sort((a, b) => a.value - b.value)[0]
        const mostAgileProfile = mostAgileEntry ? roster.find((r) => r.id === mostAgileEntry.athlete_id) : null

        return mostAgileEntry && mostAgileProfile
          ? {
              athleteName: mostAgileProfile.full_name,
              value: `${mostAgileEntry.value}s (Pro Agility)`,
              position: mostAgileProfile.position,
            }
          : null
      })()

      const mostExplosive = (() => {
        const POWER_TESTS = ['vertical_jump', 'broad_jump', 'ncmj', 'mb_chest_pass']
        const powerResults = (allResults || []).filter((r) => POWER_TESTS.includes(r.test_type))
        const POWER_MAX = { vertical_jump: 80, broad_jump: 3, ncmj: 60, mb_chest_pass: 10 }
        const powerByAthlete = {}
        for (const r of powerResults) {
          const max = POWER_MAX[r.test_type] || 100
          const normalized = Math.min(100, (r.value / max) * 100)
          if (!powerByAthlete[r.athlete_id]) powerByAthlete[r.athlete_id] = []
          powerByAthlete[r.athlete_id].push(normalized)
        }
        const avgPowerByAthlete = Object.entries(powerByAthlete)
          .map(([id, vals]) => ({ athlete_id: id, score: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) }))
          .sort((a, b) => b.score - a.score)
        const mostExplosiveEntry = avgPowerByAthlete[0]
        const mostExplosiveProfile = mostExplosiveEntry ? roster.find((r) => r.id === mostExplosiveEntry.athlete_id) : null
        return mostExplosiveEntry && mostExplosiveProfile
          ? { athleteName: mostExplosiveProfile.full_name, value: mostExplosiveEntry.score, position: mostExplosiveProfile.position }
          : null
      })()

      const needsTesting = (() => {
        const now = new Date()
        const lastByAthlete = {}
        ;(allResults || []).forEach((r) => {
          if (!lastByAthlete[r.athlete_id]) lastByAthlete[r.athlete_id] = r.date_tested
        })
        let criticalCount = 0
        let warningCount = 0
        const names = []

        rosterList.forEach((ath) => {
          const lastDate = lastByAthlete[ath.id]
          if (!lastDate) {
            criticalCount += 1
            names.push(ath.full_name)
            return
          }
          const daysAgo = Math.floor((now - new Date(lastDate)) / (1000 * 60 * 60 * 24))
          if (daysAgo > 90) {
            criticalCount += 1
            names.push(ath.full_name)
          } else if (daysAgo > 60) {
            warningCount += 1
            names.push(ath.full_name)
          }
        })

        return { criticalCount, warningCount, names }
      })()

      const strongest = (() => {
        const STRENGTH_TESTS = ['squat', 'trap_bar_deadlift', 'bench_press', 'pull_ups', 'push_ups', 'imtp']
        const strengthResults = (allResults || []).filter((r) => STRENGTH_TESTS.includes(r.test_type))
        const STRENGTH_MAX = {
          squat: 400,
          trap_bar_deadlift: 500,
          bench_press: 300,
          pull_ups: 30,
          push_ups: 60,
          imtp: 500,
        }
        const strengthByAthlete = {}
        for (const r of strengthResults) {
          const max = STRENGTH_MAX[r.test_type] || 100
          const normalized = Math.min(100, (r.value / max) * 100)
          if (!strengthByAthlete[r.athlete_id]) strengthByAthlete[r.athlete_id] = []
          strengthByAthlete[r.athlete_id].push(normalized)
        }
        const avgStrengthByAthlete = Object.entries(strengthByAthlete)
          .map(([id, vals]) => ({ athlete_id: id, score: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) }))
          .sort((a, b) => b.score - a.score)
        const strongestEntry = avgStrengthByAthlete[0]
        const strongestProfile = strongestEntry ? roster.find((r) => r.id === strongestEntry.athlete_id) : null
        return strongestEntry && strongestProfile
          ? {
              athleteName: strongestProfile.full_name,
              value: `Strength Score: ${strongestEntry.score}`,
              position: strongestProfile.position,
            }
          : null
      })()

      const conditioning = (() => {
        const beepResults = (allResults || []).filter((r) => r.test_type === 'beep_test')
        const bestBeepPerAthlete = {}
        for (const r of beepResults) {
          if (!bestBeepPerAthlete[r.athlete_id] || r.value > bestBeepPerAthlete[r.athlete_id].value) {
            bestBeepPerAthlete[r.athlete_id] = r
          }
        }
        const topBeepEntry = Object.values(bestBeepPerAthlete).sort((a, b) => b.value - a.value)[0]
        const topBeepProfile = topBeepEntry ? roster.find((r) => r.id === topBeepEntry.athlete_id) : null
        return topBeepEntry && topBeepProfile
          ? {
              athleteName: topBeepProfile.full_name,
              value: topBeepEntry.value,
              position: topBeepProfile.position,
            }
          : null
      })()

      setInsights({
        fastest,
        mostExplosive,
        needsTesting,
        strongest,
        conditioning,
        mostAgile,
      })
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
    { key: 'checkins', label: 'Check-ins', onClick: () => navigate('/checkin') },
  ]

  const getDaysAgo = (dateStr) => {
    if (!dateStr) return null
    const diff = Date.now() - new Date(dateStr).getTime()
    return Math.floor(diff / (1000 * 60 * 60 * 24))
  }

  const trendForAthlete = (athleteId) => {
    const arr = scoreHistory[athleteId] || []
    if (arr.length < 3) return null
    if (arr[0] > arr[1] && arr[1] > arr[2]) return 'up'
    if (arr[0] < arr[1] && arr[1] < arr[2]) return 'down'
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
                      const barColor = pct >= 70 ? '#3fae52' : pct >= 50 ? '#f59e0b' : 'rgba(239,68,68,0.8)'
                      return (
                        <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                          <div style={{ width: '80px', color: 'rgba(255,255,255,0.6)', fontSize: '12px' }}>
                            {cat}
                          </div>
                          <div
                            style={{
                              flex: 1,
                              height: '8px',
                              borderRadius: '4px',
                              background: 'rgba(255,255,255,0.06)',
                              overflow: 'hidden',
                            }}
                          >
                            <div
                              style={{
                                width: `${pct}%`,
                                height: '100%',
                                background: typeof scoreVal === 'number' ? barColor : 'transparent',
                                transition: 'width 0.3s ease',
                              }}
                            />
                          </div>
                          <div style={{ width: '32px', color: 'rgba(255,255,255,0.7)', fontSize: '12px', textAlign: 'right' }}>
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
                      <div
                        style={{
                          color: 'rgba(63,174,82,0.6)',
                          fontSize: '10px',
                          fontWeight: 700,
                          letterSpacing: '0.1em',
                        }}
                      >
                        🏃 FASTEST PLAYER
                      </div>
                      {insights.fastest ? (
                        <>
                          <div style={{ color: '#fff', fontSize: '18px', fontWeight: 700, marginTop: '8px' }}>
                            {insights.fastest.athleteName}
                          </div>
                          <div style={{ color: '#3fae52', fontSize: '13px', marginTop: '4px' }}>
                            {insights.fastest.value}
                          </div>
                          <div
                            style={{
                              color: 'rgba(255,255,255,0.4)',
                              fontSize: '11px',
                              marginTop: '4px',
                            }}
                          >
                            {insights.fastest.position || '—'}
                          </div>
                        </>
                      ) : (
                        <div
                          style={{
                            color: 'rgba(255,255,255,0.4)',
                            marginTop: '10px',
                          }}
                        >
                          No sprint data yet
                        </div>
                      )}
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
                      <div
                        style={{
                          color: 'rgba(245,158,11,0.8)',
                          fontSize: '10px',
                          fontWeight: 700,
                          letterSpacing: '0.1em',
                        }}
                      >
                        ⚡ MOST EXPLOSIVE
                      </div>
                      {insights.mostExplosive ? (
                        <>
                          <div style={{ color: '#fff', fontSize: '18px', fontWeight: 700, marginTop: '8px' }}>
                            {insights.mostExplosive.athleteName}
                          </div>
                          <div style={{ color: '#f59e0b', fontSize: '13px', marginTop: '4px' }}>
                            Power Score: {insights.mostExplosive.value}
                          </div>
                          <div
                            style={{
                              color: 'rgba(255,255,255,0.4)',
                              fontSize: '11px',
                              marginTop: '4px',
                            }}
                          >
                            {insights.mostExplosive.position || '—'}
                          </div>
                        </>
                      ) : (
                        <div
                          style={{
                            color: 'rgba(255,255,255,0.4)',
                            marginTop: '10px',
                          }}
                        >
                          No power data yet
                        </div>
                      )}
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
                      <div
                        style={{
                          color: 'rgba(239,68,68,0.8)',
                          fontSize: '10px',
                          fontWeight: 700,
                          letterSpacing: '0.1em',
                        }}
                      >
                        💪 STRONGEST
                      </div>
                      {insights.strongest ? (
                        <>
                          <div style={{ color: '#fff', fontSize: '18px', fontWeight: 700, marginTop: '8px' }}>
                            {insights.strongest.athleteName}
                          </div>
                          <div style={{ color: '#ef4444', fontSize: '13px', marginTop: '4px' }}>
                            {insights.strongest.value}
                          </div>
                          <div
                            style={{
                              color: 'rgba(255,255,255,0.4)',
                              fontSize: '11px',
                              marginTop: '4px',
                            }}
                          >
                            {insights.strongest.position || '—'}
                          </div>
                        </>
                      ) : (
                        <div
                          style={{
                            color: 'rgba(255,255,255,0.4)',
                            marginTop: '10px',
                          }}
                        >
                          No strength data yet
                        </div>
                      )}
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
                      <div
                        style={{
                          color: 'rgba(6,182,212,0.8)',
                          fontSize: '10px',
                          fontWeight: 700,
                          letterSpacing: '0.1em',
                        }}
                      >
                        🫁 CONDITIONING
                      </div>
                      {insights.conditioning ? (
                        <>
                          <div style={{ color: '#fff', fontSize: '18px', fontWeight: 700, marginTop: '8px' }}>
                            {insights.conditioning.athleteName}
                          </div>
                          <div style={{ color: '#06b6d4', fontSize: '13px', marginTop: '4px' }}>
                            Beep Test: Level {insights.conditioning.value}
                          </div>
                          <div
                            style={{
                              color: 'rgba(255,255,255,0.4)',
                              fontSize: '11px',
                              marginTop: '4px',
                            }}
                          >
                            {insights.conditioning.position || '—'}
                          </div>
                        </>
                      ) : (
                        <div
                          style={{
                            color: 'rgba(255,255,255,0.4)',
                            marginTop: '10px',
                          }}
                        >
                          No beep test data yet
                        </div>
                      )}
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
                      <div
                        style={{
                          color: 'rgba(139,92,246,0.8)',
                          fontSize: '10px',
                          fontWeight: 700,
                          letterSpacing: '0.1em',
                        }}
                      >
                        🔀 MOST AGILE
                      </div>
                      {insights.mostAgile ? (
                        <>
                          <div style={{ color: '#fff', fontSize: '18px', fontWeight: 700, marginTop: '8px' }}>
                            {insights.mostAgile.athleteName}
                          </div>
                          <div style={{ color: '#8b5cf6', fontSize: '13px', marginTop: '4px' }}>
                            {insights.mostAgile.value}
                          </div>
                          <div
                            style={{
                              color: 'rgba(255,255,255,0.4)',
                              fontSize: '11px',
                              marginTop: '4px',
                            }}
                          >
                            {insights.mostAgile.position || '—'}
                          </div>
                        </>
                      ) : (
                        <div
                          style={{
                            color: 'rgba(255,255,255,0.4)',
                            marginTop: '10px',
                          }}
                        >
                          No agility data yet
                        </div>
                      )}
                    </div>
                  </div>

                  {insights.needsTesting.names.length > 0 && (
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
                          const names = insights.needsTesting.names
                          const display = names.slice(0, 5)
                          const more = names.length - display.length
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
                          {insights.needsTesting.criticalCount} critical
                        </span>
                        <span style={{ color: '#f59e0b' }}>
                          {insights.needsTesting.warningCount} overdue
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
                </div>
              )}

              {activeTab === 'leaderboards' && (
                <div>
                  <div
                    style={{
                      color: '#fff',
                      fontSize: '20px',
                      fontWeight: 700,
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
                                        {entry.value}
                                        {TEST_UNITS[test] || ''}
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
