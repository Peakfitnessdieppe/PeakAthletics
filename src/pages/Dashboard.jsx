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

      const [{ data: scoreData, error: scoreError }, { data: lastData, error: lastError }] = await Promise.all([
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
      ])
      if (scoreError) throw scoreError
      if (lastError) throw lastError

      const latestScores = {}
      ;(scoreData || []).forEach((s) => {
        if (!latestScores[s.athlete_id]) latestScores[s.athlete_id] = s
      })
      const latestTested = {}
      ;(lastData || []).forEach((l) => {
        if (!latestTested[l.athlete_id]) latestTested[l.athlete_id] = l.date_tested
      })

      setScores(latestScores)
      setLastTested(latestTested)
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
    { key: 'sessions', label: 'Sessions', onClick: () => navigate('/session') },
    { key: 'checkins', label: 'Check-ins', onClick: () => navigate('/checkin') },
  ]

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
              <div style={{ color: '#fff', fontSize: '20px', fontWeight: 700, marginBottom: '16px' }}>Roster</div>
              <div style={{ marginBottom: '16px' }}>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search athlete..."
                  style={{
                    width: '100%',
                    maxWidth: '360px',
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
                <div style={{ background: '#0d1a0e', border: '1px solid rgba(63,174,82,0.2)', borderRadius: '12px', overflow: 'hidden' }}>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr',
                      padding: '12px 16px',
                      borderBottom: '1px solid rgba(63,174,82,0.2)',
                      color: 'rgba(63,174,82,0.6)',
                      fontSize: '11px',
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                    }}
                  >
                    <div>Name</div>
                    <div>Sport</div>
                    <div>Position</div>
                    <div>Age Category</div>
                    <div>Last Tested</div>
                    <div>Overall Score</div>
                  </div>

                  {filteredRoster.map((ath) => {
                    const scoreEntry = scores[ath.id]
                    const last = lastTested[ath.id]
                    const pill = scorePill(scoreEntry?.overall_score)
                    return (
                      <div
                        key={ath.id}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr',
                          padding: '12px 16px',
                          borderBottom: '1px solid rgba(255,255,255,0.04)',
                          alignItems: 'center',
                        }}
                      >
                        <div style={{ color: '#fff', fontWeight: 700 }}>{ath.full_name || 'Unknown'}</div>
                        <div style={{ color: 'rgba(255,255,255,0.6)' }}>{ath.sport || '—'}</div>
                        <div style={{ color: 'rgba(255,255,255,0.6)' }}>{ath.position || '—'}</div>
                        <div style={{ color: 'rgba(255,255,255,0.6)' }}>{ath.age_category || '—'}</div>
                        <div style={{ color: 'rgba(255,255,255,0.6)' }}>{formatDate(last)}</div>
                        <div>
                          <span
                            style={{
                              background: pill.bg,
                              color: pill.color,
                              padding: '6px 10px',
                              borderRadius: '999px',
                              fontWeight: 700,
                              fontSize: '12px',
                            }}
                          >
                            {pill.text}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

export default Dashboard
