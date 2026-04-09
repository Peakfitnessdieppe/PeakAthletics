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
  const [scoreHistory, setScoreHistory] = useState({})
  const [insights, setInsights] = useState({
    fastest: null,
    mostExplosive: null,
    needsTesting: { criticalCount: 0, warningCount: 0, names: [] },
    trendingUp: { count: 0, names: [] },
  })
  const [selectedAthlete, setSelectedAthlete] = useState(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!profile?.id) return
    loadData()
  }, [profile?.id])

  const loadData = async () => {
    try {
      const { data: teamData, error: teamError } = await supabase
        .from('pfa_teams')
        .select('id, name, sport, age_category, competition_level, primary_color')
        .eq('coach_id', profile.id)
      if (teamError) throw teamError
      setTeams(teamData || [])
      if (!teamData || !teamData.length) {
        setRoster([])
        setScores({})
        setLastTested({})
        return
      }

      const teamIds = teamData.map((t) => t.id)
      const { data: rosterData, error: rosterError } = await supabase
        .from('athlete_teams')
        .select('athlete_id, team_id, profiles(id, full_name, sport, position, age_category, gender, avatar_url)')
        .in('team_id', teamIds)
      if (rosterError) throw rosterError
      const rosterList = (rosterData || []).map((r) => ({
        athlete_id: r.athlete_id,
        team_id: r.team_id,
        ...r.profiles,
      }))
      setRoster(rosterList)

      const athleteIds = rosterList.map((r) => r.id)
      if (!athleteIds.length) {
        setScores({})
        setLastTested({})
        return
      }

      const [
        { data: scoreData, error: scoreError },
        { data: lastData, error: lastError },
        { data: allResults, error: resultsError },
        { data: gameStats, error: gameStatsError },
      ] = await Promise.all([
        supabase
          .from('pfa_composite_scores')
          .select('athlete_id, overall_score, calculated_at')
          .in('athlete_id', athleteIds)
          .order('calculated_at', { ascending: false }),
        supabase
          .from('pfa_test_results')
          .select('athlete_id, date_tested')
          .in('athlete_id', athleteIds)
          .order('date_tested', { ascending: false }),
        supabase
          .from('pfa_test_results')
          .select('athlete_id, test_type, value, date_tested')
          .in('athlete_id', athleteIds)
          .order('date_tested', { ascending: false }),
        supabase
          .from('game_stats')
          .select('athlete_id, goals, assists, points, plus_minus, season')
          .in('athlete_id', athleteIds)
          .order('season', { ascending: false }),
      ])
      if (scoreError) throw scoreError
      if (lastError) throw lastError
      if (resultsError) throw resultsError
      if (gameStatsError) throw gameStatsError

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

      // Insights calculations
      const fastest = (() => {
        const sprintResults = (allResults || []).filter((r) => r.test_type === '30m_sprint')
        const bestByAthlete = {}
        sprintResults.forEach((r) => {
          if (!bestByAthlete[r.athlete_id] || r.value < bestByAthlete[r.athlete_id]) {
            bestByAthlete[r.athlete_id] = r.value
          }
        })
        const entries = Object.entries(bestByAthlete)
        if (!entries.length) return null
        const [athleteId, value] = entries.reduce((best, current) => (current[1] < best[1] ? current : best))
        const athlete = rosterList.find((r) => r.id === athleteId)
        return athlete ? { athleteName: athlete.full_name, value, position: athlete.position } : null
      })()

      const mostExplosive = (() => {
        const POWER_TESTS = ['vertical_jump', 'broad_jump', 'ncmj']
        const MAX_MAP = { vertical_jump: 80, broad_jump: 3, ncmj: 60 }
        const bestValues = {}
        ;(allResults || [])
          .filter((r) => POWER_TESTS.includes(r.test_type))
          .forEach((r) => {
            const current = bestValues[r.athlete_id] || {}
            const existing = current[r.test_type]
            if (!existing || r.value > existing) {
              bestValues[r.athlete_id] = { ...current, [r.test_type]: r.value }
            }
          })

        let topAthlete = null
        let topScore = -Infinity

        Object.entries(bestValues).forEach(([athleteId, tests]) => {
          const scoresArr = Object.entries(tests).map(([test, val]) => {
            const max = MAX_MAP[test] || 1
            return Math.min((val / max) * 100, 100)
          })
          if (!scoresArr.length) return
          const avg = scoresArr.reduce((a, b) => a + b, 0) / scoresArr.length
          if (avg > topScore) {
            topScore = avg
            topAthlete = athleteId
          }
        })

        if (!topAthlete || topScore === -Infinity) return null
        const athlete = rosterList.find((r) => r.id === topAthlete)
        return athlete ? { athleteName: athlete.full_name, value: Number(topScore.toFixed(1)), position: athlete.position } : null
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

      const trendingUp = (() => {
        const names = []
        rosterList.forEach((ath) => {
          const scoresArr = history[ath.id] || []
          if (scoresArr.length < 3) return
          if (scoresArr[0] > scoresArr[1] && scoresArr[1] > scoresArr[2]) {
            names.push(ath.full_name)
          }
        })
        return { count: names.length, names }
      })()

      setInsights({
        fastest,
        mostExplosive,
        needsTesting,
        trendingUp,
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
          {activeTab === 'roster' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '32px' }}>
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
                  <div style={{ color: 'rgba(63,174,82,0.6)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em' }}>
                    🏃 FASTEST PLAYER
                  </div>
                  {insights.fastest ? (
                    <>
                      <div style={{ color: '#fff', fontSize: '18px', fontWeight: 700, marginTop: '8px' }}>{insights.fastest.athleteName}</div>
                      <div style={{ color: '#3fae52', fontSize: '13px', marginTop: '4px' }}>{insights.fastest.value}s (30m sprint)</div>
                      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', marginTop: '4px' }}>{insights.fastest.position || '—'}</div>
                    </>
                  ) : (
                    <div style={{ color: 'rgba(255,255,255,0.4)', marginTop: '10px' }}>No sprint data yet</div>
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
                  <div style={{ color: 'rgba(245,158,11,0.8)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em' }}>
                    ⚡ MOST EXPLOSIVE
                  </div>
                  {insights.mostExplosive ? (
                    <>
                      <div style={{ color: '#fff', fontSize: '18px', fontWeight: 700, marginTop: '8px' }}>{insights.mostExplosive.athleteName}</div>
                      <div style={{ color: '#f59e0b', fontSize: '13px', marginTop: '4px' }}>Power Score: {insights.mostExplosive.value}</div>
                      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', marginTop: '4px' }}>{insights.mostExplosive.position || '—'}</div>
                    </>
                  ) : (
                    <div style={{ color: 'rgba(255,255,255,0.4)', marginTop: '10px' }}>No power data yet</div>
                  )}
                </div>

                {/* Needs testing */}
                <div
                  style={{
                    background: '#0d1a0e',
                    border: '1px solid rgba(63,174,82,0.2)',
                    borderRadius: '12px',
                    padding: '20px',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ color: 'rgba(239,68,68,0.8)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em' }}>
                    ⚠️ NEEDS TESTING
                  </div>
                  {insights.needsTesting.criticalCount === 0 && insights.needsTesting.warningCount === 0 ? (
                    <div style={{ color: '#3fae52', fontWeight: 700, marginTop: '10px' }}>✓ All athletes current</div>
                  ) : (
                    <>
                      <div style={{ display: 'flex', gap: '12px', marginTop: '10px', alignItems: 'baseline' }}>
                        <div>
                          <div style={{ color: '#ef4444', fontSize: '20px', fontWeight: 800 }}>{insights.needsTesting.criticalCount}</div>
                          <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '11px' }}>90+ days</div>
                        </div>
                        <div>
                          <div style={{ color: '#f59e0b', fontSize: '20px', fontWeight: 800 }}>{insights.needsTesting.warningCount}</div>
                          <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '11px' }}>60+ days</div>
                        </div>
                      </div>
                      {insights.needsTesting.names.slice(0, 2).map((name) => (
                        <div key={name} style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px' }}>
                          {name}
                        </div>
                      ))}
                    </>
                  )}
                </div>

                {/* Peaking */}
                <div
                  style={{
                    background: '#0d1a0e',
                    border: '1px solid rgba(63,174,82,0.2)',
                    borderRadius: '12px',
                    padding: '20px',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ color: 'rgba(63,174,82,0.8)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em' }}>
                    📈 PEAKING THIS MONTH
                  </div>
                  {insights.trendingUp.count > 0 ? (
                    <>
                      <div style={{ color: '#3fae52', fontSize: '36px', fontWeight: 800, marginTop: '6px', lineHeight: 1 }}>
                        {insights.trendingUp.count}
                      </div>
                      <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', marginTop: '2px' }}>athletes</div>
                      {insights.trendingUp.names.slice(0, 2).map((name) => (
                        <div key={name} style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px' }}>
                          {name}
                        </div>
                      ))}
                    </>
                  ) : (
                    <div style={{ color: 'rgba(255,255,255,0.4)', marginTop: '10px' }}>No trend data yet</div>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ color: '#fff', fontSize: '20px', fontWeight: 700 }}>Roster</div>
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
                <div style={{ color: 'rgba(255,255,255,0.5)', textAlign: 'center', padding: '24px 0' }}>
                  No team assigned. Contact admin.
                </div>
              ) : !roster.length ? (
                <div style={{ color: 'rgba(255,255,255,0.5)', textAlign: 'center', padding: '24px 0' }}>
                  No athletes on your roster yet.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
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
                          <div style={{ color: '#fff', fontSize: '14px', fontWeight: 700, marginTop: '8px' }}>{ath.full_name || 'Unknown'}</div>
                          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', marginTop: '4px' }}>
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
                          <div style={{ color: scoreColor(overallScore), fontSize: '28px', fontWeight: 800 }}>
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

                        <div style={{ padding: '0 16px 12px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          {/* Last tested */}
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

                          {/* Trend badge */}
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
            <div style={{ color: 'rgba(255,255,255,0.4)', padding: '40px', textAlign: 'center' }}>
              Leaderboards coming soon
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

export default Dashboard
