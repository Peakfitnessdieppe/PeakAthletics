import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DashboardLayout from '../components/layout/DashboardLayout'
import useAuth from '../hooks/useAuth'
import { supabase } from '../services/supabase'
import { getAllAthletes, getAthletesByTeamJunction, getCheckins, markCheckinReviewed } from '../services/athletes'

const tabList = ['Roster', 'Sessions', 'Progress Reports', 'Check-ins']

const Dashboard = () => {
  const navigate = useNavigate()
  const { user, profile, signOut } = useAuth()
  const isCoach = profile?.role === 'team_coach'
  const isStaff = profile?.role === 'pfa_staff' || profile?.role === 'pfa_admin'

  const [activeTab, setActiveTab] = useState('Roster')
  const [athletes, setAthletes] = useState([])
  const [athletesLoading, setAthletesLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [sportFilter, setSportFilter] = useState('All')
  const [teamFilter, setTeamFilter] = useState('All')
  const [teams, setTeams] = useState([])
  const [sessions, setSessions] = useState([])
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [checkins, setCheckins] = useState([])
  const [checkinsLoading, setCheckinsLoading] = useState(false)
  const [expandedAthleteId, setExpandedAthleteId] = useState(null)

  const [recentResults, setRecentResults] = useState([])
  const [compositeScores, setCompositeScores] = useState([])

  useEffect(() => {
    loadTeams()
  }, [])

  useEffect(() => {
    loadAthletesAndData()
    loadSessions()
    loadCheckins()
  }, [profile?.role])

  const loadTeams = async () => {
    const { data } = await supabase.from('pfa_teams').select('*').order('name')
    setTeams(data || [])
  }

  const loadAthletesAndData = async () => {
    setAthletesLoading(true)
    try {
      let roster = []
      if (isCoach && profile?.team_id) {
        roster = await getAthletesByTeamJunction(profile.team_id)
      } else {
        roster = await getAllAthletes()
      }
      setAthletes(roster || [])
      const athleteIds = (roster || []).map((a) => a.id)
      if (athleteIds.length) {
        const [{ data: resultsData }, { data: compositeData }] = await Promise.all([
          supabase
            .from('pfa_test_results')
            .select('*')
            .in('athlete_id', athleteIds)
            .order('date_tested', { ascending: false })
            .limit(300),
          supabase
            .from('pfa_composite_scores')
            .select('*')
            .in('athlete_id', athleteIds)
            .order('scored_at', { ascending: false })
            .limit(200),
        ])
        setRecentResults(resultsData || [])
        setCompositeScores(compositeData || [])
      } else {
        setRecentResults([])
        setCompositeScores([])
      }
    } catch (err) {
      console.error('Roster load error', err)
    }
    setAthletesLoading(false)
  }

  const loadSessions = async () => {
    setSessionsLoading(true)
    try {
      let query = supabase.from('test_sessions').select('*, pfa_teams(name)').order('session_date', { ascending: false })
      if (isCoach && profile?.team_id) {
        query = query.eq('team_id', profile.team_id)
      }
      const { data } = await query
      setSessions(data || [])
    } catch (err) {
      console.error('Sessions load error', err)
    }
    setSessionsLoading(false)
  }

  const loadCheckins = async () => {
    setCheckinsLoading(true)
    try {
      const data = await getCheckins(isCoach ? profile?.team_id : null)
      setCheckins(data || [])
    } catch (err) {
      console.error('Checkins load error', err)
    }
    setCheckinsLoading(false)
  }

  const filteredAthletes = useMemo(() => {
    const term = search.toLowerCase()
    return athletes
      .filter((a) => (sportFilter === 'All' ? true : a.sport === sportFilter))
      .filter((a) => (teamFilter === 'All' ? true : a.team_id === teamFilter))
      .filter((a) => a.full_name?.toLowerCase().includes(term))
  }, [athletes, search, sportFilter, teamFilter])

  const getLatestComposite = (athleteId) => {
    const list = compositeScores.filter((c) => c.athlete_id === athleteId)
    if (!list.length) return null
    return list.sort((a, b) => new Date(b.scored_at) - new Date(a.scored_at))[0]
  }

  const getTrend = (athleteId) => {
    const list = compositeScores.filter((c) => c.athlete_id === athleteId).sort((a, b) => new Date(a.scored_at) - new Date(b.scored_at))
    if (list.length < 2) return 'flat'
    const first = list[0]?.overall_score
    const last = list[list.length - 1]?.overall_score
    if (last > first) return 'up'
    if (last < first) return 'down'
    return 'flat'
  }

  const getLastTested = (athleteId) => {
    const res = recentResults.find((r) => r.athlete_id === athleteId)
    return res?.date_tested?.slice(0, 10) || '—'
  }

  const getRecentByCategory = (athleteId) => {
    const grouped = {}
    recentResults
      .filter((r) => r.athlete_id === athleteId)
      .forEach((r) => {
        if (!grouped[r.category]) grouped[r.category] = []
        if (grouped[r.category].length < 3) grouped[r.category].push(r)
      })
    return grouped
  }

  const metrics = useMemo(() => {
    const total = filteredAthletes.length
    const athleteIds = filteredAthletes.map((a) => a.id)
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    const testedThisMonth = recentResults.filter(
      (r) => athleteIds.includes(r.athlete_id) && new Date(r.date_tested) >= startOfMonth
    ).length
    const avgScoreList = athleteIds
      .map((id) => getLatestComposite(id)?.overall_score)
      .filter((v) => typeof v === 'number')
    const avgOverall = avgScoreList.length
      ? (avgScoreList.reduce((a, b) => a + b, 0) / avgScoreList.length).toFixed(2)
      : '—'
    const needAttention = athleteIds.filter((id) => {
      const res = recentResults.find((r) => r.athlete_id === id)
      if (!res) return true
      const days = (Date.now() - new Date(res.date_tested).getTime()) / (1000 * 60 * 60 * 24)
      return days > 45
    }).length
    return { total, testedThisMonth, avgOverall, needAttention }
  }, [filteredAthletes, recentResults, getLatestComposite])

  const renderTrend = (athleteId) => {
    const trend = getTrend(athleteId)
    if (trend === 'up') return <span className="text-pfa-green">▲</span>
    if (trend === 'down') return <span className="text-red-400">▼</span>
    return <span className="text-white/50">—</span>
  }

  const renderRoster = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <MetricCard label="Total Athletes" value={metrics.total} />
        <MetricCard label="Tested This Month" value={metrics.testedThisMonth} />
        <MetricCard label="Avg Overall Score" value={metrics.avgOverall} />
        <MetricCard label="Need Attention" value={metrics.needAttention} />
      </div>

      <div className="flex flex-col md:flex-row gap-3 items-start">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search athlete"
          className="bg-[#0d1a0e] border border-pfa-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-pfa-green"
        />
        <select
          value={sportFilter}
          onChange={(e) => setSportFilter(e.target.value)}
          className="bg-[#0d1a0e] border border-pfa-border rounded-lg px-3 py-2 text-sm text-white"
        >
          <option value="All">All Sports</option>
          {[...new Set(athletes.map((a) => a.sport).filter(Boolean))].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        {isStaff && (
          <select
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value)}
            className="bg-[#0d1a0e] border border-pfa-border rounded-lg px-3 py-2 text-sm text-white"
          >
            <option value="All">All Teams/Groups</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="overflow-x-auto bg-[#0d1a0e] border border-pfa-border rounded-xl">
        <table className="min-w-full text-sm">
          <thead className="text-white/60">
            <tr className="border-b border-pfa-border">
              <th className="py-3 px-3 text-left">Name</th>
              <th className="py-3 px-3 text-left">Sport</th>
              <th className="py-3 px-3 text-left">Position</th>
              <th className="py-3 px-3 text-left">Age</th>
              <th className="py-3 px-3 text-left">Competition</th>
              <th className="py-3 px-3 text-left">Last Tested</th>
              <th className="py-3 px-3 text-left">Overall</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-pfa-border">
            {athletesLoading ? (
              <tr>
                <td className="py-3 px-3 text-white/60" colSpan={7}>
                  Loading...
                </td>
              </tr>
            ) : (
              filteredAthletes.map((a) => {
                const latestComposite = getLatestComposite(a.id)
                const recent = getRecentByCategory(a.id)
                return (
                  <React.Fragment key={a.id}>
                    <tr
                      className="hover:bg-white/5 cursor-pointer"
                      onClick={() => setExpandedAthleteId(expandedAthleteId === a.id ? null : a.id)}
                    >
                      <td className="py-3 px-3 flex items-center gap-2">
                        <span className="text-white/90">{a.full_name}</span>
                        {renderTrend(a.id)}
                      </td>
                      <td className="py-3 px-3">{a.sport}</td>
                      <td className="py-3 px-3">{a.position || '-'}</td>
                      <td className="py-3 px-3">{a.age_category || '-'}</td>
                      <td className="py-3 px-3">{a.competition_level || '-'}</td>
                      <td className="py-3 px-3">{getLastTested(a.id)}</td>
                      <td className="py-3 px-3">{latestComposite?.overall_score ?? '—'}</td>
                    </tr>
                    {expandedAthleteId === a.id && (
                      <tr className="bg-white/5">
                        <td colSpan={7} className="py-3 px-3 text-sm text-white/80">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {Object.entries(recent).map(([cat, list]) => (
                              <div key={cat} className="bg-[#0a0f0a] border border-pfa-border rounded-lg p-3">
                                <div className="text-white font-semibold mb-2 uppercase text-xs">{cat}</div>
                                {list.slice(0, 3).map((r) => (
                                  <div key={r.id} className="flex items-center justify-between text-white/80 text-xs">
                                    <span>{r.test_type}</span>
                                    <span>{r.value}{r.unit || ''}</span>
                                  </div>
                                ))}
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )

  const renderSessions = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Sessions</h3>
        <button
          onClick={() => navigate('/session')}
          className="bg-pfa-green text-black font-semibold px-4 py-2 rounded-lg hover:brightness-110"
        >
          New Session
        </button>
      </div>
      <div className="overflow-x-auto bg-[#0d1a0e] border border-pfa-border rounded-xl">
        <table className="min-w-full text-sm">
          <thead className="text-white/60">
            <tr className="border-b border-pfa-border">
              <th className="py-3 px-3 text-left">Date</th>
              <th className="py-3 px-3 text-left">Team/Group</th>
              <th className="py-3 px-3 text-left">Test</th>
              <th className="py-3 px-3 text-left">Status</th>
              <th className="py-3 px-3 text-left">Conducted By</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-pfa-border">
            {sessionsLoading ? (
              <tr>
                <td className="py-3 px-3 text-white/60" colSpan={5}>
                  Loading...
                </td>
              </tr>
            ) : (
              sessions.map((s) => (
                <tr key={s.id} className="hover:bg-white/5">
                  <td className="py-3 px-3">{s.session_date}</td>
                  <td className="py-3 px-3">{s.pfa_teams?.name || 'No Team'}</td>
                  <td className="py-3 px-3">{s.test_type}</td>
                  <td className="py-3 px-3 capitalize">{s.status}</td>
                  <td className="py-3 px-3">{s.conducted_by || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )

  const renderProgress = () => (
    <div className="bg-[#0d1a0e] border border-pfa-border rounded-xl p-6 text-center text-white/60">
      Progress reports coming soon
    </div>
  )

  const renderCheckins = () => (
    <div className="space-y-4">
      <div className="text-lg font-semibold text-white">Recent Check-ins</div>
      <div className="overflow-x-auto bg-[#0d1a0e] border border-pfa-border rounded-xl">
        <table className="min-w-full text-sm">
          <thead className="text-white/60">
            <tr className="border-b border-pfa-border">
              <th className="py-3 px-3 text-left">Athlete</th>
              <th className="py-3 px-3 text-left">Date</th>
              <th className="py-3 px-3 text-left">Sleep</th>
              <th className="py-3 px-3 text-left">Energy</th>
              <th className="py-3 px-3 text-left">Stress</th>
              <th className="py-3 px-3 text-left">Nutrition</th>
              <th className="py-3 px-3 text-left">Soreness</th>
              <th className="py-3 px-3 text-left">Notes</th>
              <th className="py-3 px-3 text-left">Flagged</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-pfa-border">
            {checkinsLoading ? (
              <tr>
                <td className="py-3 px-3 text-white/60" colSpan={9}>
                  Loading...
                </td>
              </tr>
            ) : (
              checkins.map((c) => (
                <tr key={c.id} className="hover:bg-white/5 cursor-pointer" onClick={async () => {
                  await markCheckinReviewed(c.id, user?.id)
                  loadCheckins()
                }}>
                  <td className="py-3 px-3">{c.profiles?.full_name}</td>
                  <td className="py-3 px-3">{c.checkin_date?.slice(0, 10)}</td>
                  <td className="py-3 px-3">{c.sleep}</td>
                  <td className="py-3 px-3">{c.energy}</td>
                  <td className="py-3 px-3">{c.stress}</td>
                  <td className="py-3 px-3">{c.nutrition}</td>
                  <td className="py-3 px-3">{c.soreness}</td>
                  <td className="py-3 px-3 truncate max-w-xs">{c.notes || '—'}</td>
                  <td className="py-3 px-3">{c.flagged ? <span className="text-red-400">Flagged</span> : '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )

  const renderTab = () => {
    switch (activeTab) {
      case 'Roster':
        return renderRoster()
      case 'Sessions':
        return renderSessions()
      case 'Progress Reports':
        return renderProgress()
      case 'Check-ins':
        return renderCheckins()
      default:
        return null
    }
  }

  return (
    <DashboardLayout>
      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6">
        <aside className="bg-[#0d1a0e] border border-pfa-border rounded-xl p-4 h-max">
          <div className="text-sm font-semibold tracking-wide text-pfa-green mb-6">PEAK FITNESS ATHLETICS</div>
          <div className="space-y-1">
            {tabList.map((item) => (
              <button
                key={item}
                onClick={() => setActiveTab(item)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm ${
                  activeTab === item ? 'bg-white/10 text-pfa-green border border-pfa-border' : 'text-white/60'
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </aside>

        <main className="space-y-6">
          <div className="bg-[#0d1a0e] border border-pfa-border rounded-xl p-4 flex items-center justify-between">
            <div>
              <div className="text-lg font-semibold text-white">{activeTab}</div>
              <div className="text-white/60 text-sm">PEAK FITNESS ATHLETICS</div>
            </div>
            <div className="flex items-center gap-3 text-sm text-white/70">
              <div>{profile?.full_name || user?.email}</div>
              <div className="capitalize">{profile?.role}</div>
              {isCoach && <div className="text-pfa-green">Team: {profile?.team_id || '-'}</div>}
              <button onClick={signOut} className="text-white/60 hover:text-white">
                Sign Out
              </button>
            </div>
          </div>

          {renderTab()}
        </main>
      </div>
    </DashboardLayout>
  )
}

const MetricCard = ({ label, value }) => (
  <div className="bg-[#0d1a0e] border border-pfa-border rounded-xl p-4">
    <div className="text-white/60 text-sm">{label}</div>
    <div className="text-2xl font-bold text-white mt-1">{value}</div>
  </div>
)

export default Dashboard
