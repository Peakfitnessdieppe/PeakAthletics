import React, { useEffect, useMemo, useState } from 'react'
import DashboardLayout from '../components/layout/DashboardLayout'
import useAuth from '../hooks/useAuth'
import { supabase } from '../services/supabase'
import {
  getAllAthletes,
  getAthleteTeams,
  addAthleteToTeam,
  removeAthleteFromTeam,
  getRoster,
  getRosterStats,
} from '../services/athletes'
import { getAllTeams, createTeam, updateTeam, getTeamRoster } from '../services/teams'
import {
  createUser as createAdminUser,
  deleteUser as deleteAdminUser,
  updateUser as updateAdminUser,
  createAndLinkAthlete,
} from '../services/adminUsers'
import { SPORTS } from '../constants/sports'

const sectionList = ['Dashboard', 'Users', 'Teams', 'Athletes', 'Roster', 'Settings']

const navItemBase =
  'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium cursor-pointer transition-colors'

const Admin = () => {
  const { user, profile, signOut } = useAuth()
  const [activeSection, setActiveSection] = useState('Dashboard')

  const [metrics, setMetrics] = useState({
    athletes: 0,
    teams: 0,
    staff: 0,
    coaches: 0,
  })
  const [recentUsers, setRecentUsers] = useState([])

  const [users, setUsers] = useState([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [userSearch, setUserSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('All')
  const [userModalOpen, setUserModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [userForm, setUserForm] = useState({
    full_name: '',
    email: '',
    password: '',
    role: 'pfa_staff',
    sport: SPORTS[0],
    position: '',
    date_of_birth: '',
    gender: 'male',
    age_category: '',
    competition_level: '',
    team_id: '',
    linked_athlete_id: '',
  })
  const [userActionMessage, setUserActionMessage] = useState('')

  const [teams, setTeams] = useState([])
  const [teamsLoading, setTeamsLoading] = useState(false)
  const [teamModalOpen, setTeamModalOpen] = useState(false)
  const [editingTeam, setEditingTeam] = useState(null)
  const [teamForm, setTeamForm] = useState({
    name: '',
    sport: SPORTS[0],
    age_category: '',
    competition_level: '',
    primary_color: '#3fae52',
    secondary_color: '#ffffff',
    season: '',
    coach_id: '',
  })

  const [athletes, setAthletes] = useState([])
  const [athletesLoading, setAthletesLoading] = useState(false)
  const [athleteSearch, setAthleteSearch] = useState('')
  const [athleteSportFilter, setAthleteSportFilter] = useState('All')
  const [athleteTeamFilter, setAthleteTeamFilter] = useState('All')
  const [expandedAthleteId, setExpandedAthleteId] = useState(null)
  const [athleteTeamsMap, setAthleteTeamsMap] = useState({})
  const [athleteTeamSelect, setAthleteTeamSelect] = useState({})

  const [roster, setRoster] = useState([])
  const [rosterLoading, setRosterLoading] = useState(false)
  const [rosterStats, setRosterStats] = useState({ total: 0, linked: 0, pending: 0, results: 0 })
  const [rosterSearch, setRosterSearch] = useState('')
  const [rosterSportFilter, setRosterSportFilter] = useState('All')
  const [rosterTab, setRosterTab] = useState('Pending')
  const [rosterModalOpen, setRosterModalOpen] = useState(false)
  const [selectedRosterAthlete, setSelectedRosterAthlete] = useState(null)
  const [rosterEmail, setRosterEmail] = useState('')
  const [rosterPassword, setRosterPassword] = useState('PFA2025!')
  const [rosterMessage, setRosterMessage] = useState('')
  const [rosterResultCounts, setRosterResultCounts] = useState({})

  const [passwordChange, setPasswordChange] = useState('')
  const [passwordMessage, setPasswordMessage] = useState('')

  const filteredUsers = useMemo(() => {
    const term = userSearch.toLowerCase()
    return users
      .filter((u) =>
        roleFilter === 'All' ? true : u.role === roleFilter
      )
      .filter((u) =>
        u.full_name?.toLowerCase().includes(term) || u.email?.toLowerCase().includes(term)
      )
  }, [users, userSearch, roleFilter])

  const filteredAthletes = useMemo(() => {
    const term = athleteSearch.toLowerCase()
    return athletes
      .filter((a) =>
        athleteSportFilter === 'All' ? true : a.sport === athleteSportFilter
      )
      .filter((a) => (athleteTeamFilter === 'All' ? true : a.team_id === athleteTeamFilter))
      .filter((a) => a.full_name?.toLowerCase().includes(term))
  }, [athletes, athleteSearch, athleteSportFilter, athleteTeamFilter])

  const filteredRoster = useMemo(() => {
    const term = rosterSearch.toLowerCase()
    return roster
      .filter((r) => (rosterSportFilter === 'All' ? true : r.sport === rosterSportFilter))
      .filter((r) => r.full_name?.toLowerCase().includes(term))
  }, [roster, rosterSearch, rosterSportFilter])

  const loadMetrics = async () => {
    const [{ count: athletesCount }, { count: coachCount }, { count: staffCount }, { count: teamCount }] =
      await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'athlete'),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'team_coach'),
        supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .in('role', ['pfa_admin', 'pfa_staff']),
        supabase.from('pfa_teams').select('id', { count: 'exact', head: true }),
      ])

    setMetrics({
      athletes: athletesCount || 0,
      teams: teamCount || 0,
      staff: staffCount || 0,
      coaches: coachCount || 0,
    })
  }

  const loadRecentUsers = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10)
    if (!error) setRecentUsers(data || [])
  }

  const loadUsers = async () => {
    setUsersLoading(true)
    const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
    if (!error) setUsers(data || [])
    setUsersLoading(false)
  }

  const loadTeams = async () => {
    setTeamsLoading(true)
    try {
      const data = await getAllTeams()
      setTeams(data || [])
    } catch (err) {
      console.error('Teams load error', err)
    }
    setTeamsLoading(false)
  }

  const loadAthletes = async () => {
    setAthletesLoading(true)
    try {
      const data = await getAllAthletes()
      setAthletes(data || [])
    } catch (err) {
      console.error('Athletes load error', err)
    }
    setAthletesLoading(false)
  }

  const loadAthleteTeams = async (athleteId) => {
    try {
      const data = await getAthleteTeams(athleteId)
      setAthleteTeamsMap((prev) => ({ ...prev, [athleteId]: data || [] }))
    } catch (err) {
      console.error('Athlete teams load error', err)
    }
  }

  useEffect(() => {
    loadMetrics()
    loadRecentUsers()
    loadUsers()
    loadTeams()
    loadAthletes()
    loadRoster()
    loadRosterStats()
  }, [])

  const loadRoster = async () => {
    setRosterLoading(true)
    try {
      const data = await getRoster()
      let rosterData = data || []

      const linkedNames = rosterData.filter((r) => r.auth_linked).map((r) => r.full_name)
      if (linkedNames.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('full_name', linkedNames)
        const profileIds = (profilesData || []).map((p) => p.id)
        const { data: resultsData } = await supabase
          .from('pfa_test_results')
          .select('athlete_id')
          .in('athlete_id', profileIds)
        const countByAthlete = (resultsData || []).reduce((acc, row) => {
          acc[row.athlete_id] = (acc[row.athlete_id] || 0) + 1
          return acc
        }, {})
        const emailByName = {}
        ;(profilesData || []).forEach((p) => {
          emailByName[p.full_name] = p.email
          if (countByAthlete[p.id]) {
            // Map counts by name (sum if multiple profiles share name)
            emailByName[p.full_name] = p.email
          }
        })
        const countsByName = {}
        ;(profilesData || []).forEach((p) => {
          const count = countByAthlete[p.id] || 0
          countsByName[p.full_name] = (countsByName[p.full_name] || 0) + count
        })
        rosterData = rosterData.map((r) => ({
          ...r,
          linked_email: r.linked_email || emailByName[r.full_name],
        }))
        const countsMap = rosterData.reduce((acc, r) => {
          acc[r.id] = countsByName[r.full_name] || 0
          return acc
        }, {})
        setRosterResultCounts(countsMap)
      } else {
        setRosterResultCounts({})
      }

      setRoster(rosterData)
    } catch (err) {
      console.error('Roster load error', err)
    }
    setRosterLoading(false)
  }

  const loadRosterStats = async () => {
    try {
      const stats = await getRosterStats()
      setRosterStats(stats)
    } catch (err) {
      console.error('Roster stats error', err)
    }
  }

  const openCreateUser = () => {
    setEditingUser(null)
    setUserForm({
      full_name: '',
      email: '',
      password: '',
      role: 'pfa_staff',
      sport: SPORTS[0],
      position: '',
      date_of_birth: '',
      gender: 'male',
      age_category: '',
      competition_level: '',
      team_id: '',
      linked_athlete_id: '',
    })
    setUserModalOpen(true)
  }

  const openEditUser = (userRow) => {
    setEditingUser(userRow)
    setUserForm({
      full_name: userRow.full_name || '',
      email: userRow.email || '',
      password: '',
      role: userRow.role || 'pfa_staff',
      sport: userRow.sport || SPORTS[0],
      position: userRow.position || '',
      date_of_birth: userRow.date_of_birth ? userRow.date_of_birth.slice(0, 10) : '',
      gender: userRow.gender || 'male',
      age_category: userRow.age_category || '',
      competition_level: userRow.competition_level || '',
      team_id: userRow.team_id || '',
      linked_athlete_id: userRow.linked_athlete_id || '',
    })
    setUserModalOpen(true)
  }

  const handleUserSubmit = async (e) => {
    e.preventDefault()
    setUserActionMessage('')
    try {
      const sanitizedUser = {
        ...userForm,
        team_id: userForm.team_id || null,
        linked_athlete_id: userForm.linked_athlete_id || null,
      }

      if (editingUser) {
        await updateAdminUser(editingUser.id, sanitizedUser)
        setUserActionMessage('User updated')
      } else {
        await createAdminUser(sanitizedUser)
        setUserActionMessage('User created')
      }
      setUserModalOpen(false)
      loadUsers()
      loadMetrics()
    } catch (err) {
      setUserActionMessage(err.message)
    }
  }

  const handleDeleteUser = async (id) => {
    if (!window.confirm('Delete this user?')) return
    try {
      await deleteAdminUser(id)
      loadUsers()
    } catch (err) {
      console.error('Delete user failed', err)
    }
  }

  const openCreateTeam = () => {
    setEditingTeam(null)
    setTeamForm({
      name: '',
      sport: SPORTS[0],
      age_category: '',
      competition_level: '',
      primary_color: '#3fae52',
      secondary_color: '#ffffff',
      season: '',
      coach_id: '',
    })
    setTeamModalOpen(true)
  }

  const openEditTeam = (teamRow) => {
    setEditingTeam(teamRow)
    setTeamForm({
      name: teamRow.name || '',
      sport: teamRow.sport || SPORTS[0],
      age_category: teamRow.age_category || '',
      competition_level: teamRow.competition_level || '',
      primary_color: teamRow.primary_color || '#3fae52',
      secondary_color: teamRow.secondary_color || '#ffffff',
      season: teamRow.season || '',
      coach_id: teamRow.coach_id || '',
    })
    setTeamModalOpen(true)
  }

  const handleTeamSubmit = async (e) => {
    e.preventDefault()
    try {
      const sanitizedTeam = {
        ...teamForm,
        coach_id: teamForm.coach_id || null,
      }

      if (editingTeam) {
        await updateTeam(editingTeam.id, sanitizedTeam)
      } else {
        await createTeam(sanitizedTeam)
      }
      setTeamModalOpen(false)
      loadTeams()
      loadMetrics()
    } catch (err) {
      console.error('Team save failed', err)
    }
  }

  const handleDeleteTeam = async (id) => {
    if (!window.confirm('Delete this team?')) return
    const { error } = await supabase.from('pfa_teams').delete().eq('id', id)
    if (!error) {
      loadTeams()
      loadMetrics()
    }
  }

  const handlePasswordChange = async () => {
    setPasswordMessage('')
    const { error } = await supabase.auth.updateUser({ password: passwordChange })
    if (error) {
      setPasswordMessage(error.message)
    } else {
      setPasswordMessage('Password updated')
      setPasswordChange('')
    }
  }

  const SectionContainer = ({ children }) => (
    <div className="bg-[#0d1a0e] border border-pfa-border rounded-xl p-6">{children}</div>
  )

  const MetricCard = ({ label, value }) => (
    <div className="bg-[#0d1a0e] border border-pfa-border rounded-xl p-4">
      <div className="text-sm text-white/60">{label}</div>
      <div className="text-2xl font-bold text-pfa-green mt-2">{value}</div>
    </div>
  )

  const renderRosterMetrics = () => (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {[
        { label: 'Total in roster', value: rosterStats.total },
        { label: 'Already linked', value: rosterStats.linked },
        { label: 'Pending', value: rosterStats.pending },
        { label: 'Test results ready', value: rosterStats.results },
      ].map((m) => (
        <div key={m.label} className="bg-[#0d1a0e] border border-pfa-border rounded-xl p-4">
          <div className="text-white/60 text-sm">{m.label}</div>
          <div className="text-2xl font-bold text-white mt-1">{m.value}</div>
        </div>
      ))}
    </div>
  )

  const renderRosterTable = (rows, linkedView = false) => (
    <div className="overflow-x-auto bg-[#0d1a0e] border border-pfa-border rounded-xl">
      <table className="min-w-full text-sm">
        <thead className="text-white/60">
          {linkedView ? (
            <tr className="border-b border-pfa-border">
              <th className="py-3 px-3 text-left">Name</th>
              <th className="py-3 px-3 text-left">Email</th>
              <th className="py-3 px-3 text-left">Sport</th>
              <th className="py-3 px-3 text-left">Results Migrated</th>
            </tr>
          ) : (
            <tr className="border-b border-pfa-border">
              <th className="py-3 px-3 text-left">Name</th>
              <th className="py-3 px-3 text-left">DOB</th>
              <th className="py-3 px-3 text-left">Sport</th>
              <th className="py-3 px-3 text-left">Position</th>
              <th className="py-3 px-3 text-left">Team</th>
              <th className="py-3 px-3 text-left">Age Category</th>
              <th className="py-3 px-3 text-left">Competition Level</th>
              <th className="py-3 px-3 text-left">Action</th>
            </tr>
          )}
        </thead>
        <tbody className="divide-y divide-pfa-border">
          {rosterLoading ? (
            <tr>
              <td className="py-3 px-3 text-white/60" colSpan={8}>
                Loading...
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td className="py-3 px-3 text-white/60" colSpan={8}>
                No athletes found.
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr key={r.id} className="hover:bg-white/5">
                <td className="py-3 px-3 text-white">{r.full_name}</td>
                {linkedView ? (
                  <>
                    <td className="py-3 px-3">{r.linked_email || r.email || '-'}</td>
                    <td className="py-3 px-3">{r.sport || '-'}</td>
                    <td className="py-3 px-3 text-pfa-green font-semibold">
                      {rosterResultCounts[r.id] ?? 0}
                    </td>
                  </>
                ) : (
                  <>
                    <td className="py-3 px-3">{r.date_of_birth?.slice(0, 10) || '-'}</td>
                    <td className="py-3 px-3">{r.sport || '-'}</td>
                    <td className="py-3 px-3">{r.position || '-'}</td>
                    <td className="py-3 px-3">{r.team || '-'}</td>
                    <td className="py-3 px-3">{r.age_category || '-'}</td>
                    <td className="py-3 px-3">{r.competition_level || '-'}</td>
                    <td className="py-3 px-3">
                      {r.auth_linked ? (
                        <div className="flex items-center gap-2 text-pfa-green">✓ Linked</div>
                      ) : (
                        <button
                          className="bg-pfa-green text-black font-semibold px-3 py-2 rounded-lg text-sm"
                          onClick={() => {
                            setSelectedRosterAthlete(r)
                            setRosterEmail(r.email || '')
                            setRosterPassword('PFA2025!')
                            setRosterModalOpen(true)
                          }}
                        >
                          Create Account
                        </button>
                      )}
                    </td>
                  </>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )

  const linkedRosterRows = useMemo(
    () => filteredRoster.filter((r) => r.auth_linked),
    [filteredRoster]
  )
  const pendingRosterRows = useMemo(
    () => filteredRoster.filter((r) => !r.auth_linked),
    [filteredRoster]
  )

  const handleCreateAndLink = async () => {
    if (!selectedRosterAthlete || !rosterEmail || rosterPassword.length < 8) return
    setRosterMessage('')
    try {
      const { resultsCount } = await createAndLinkAthlete(selectedRosterAthlete, rosterEmail, rosterPassword)
      setRosterMessage(`Account created for ${selectedRosterAthlete.full_name}. ${resultsCount} test results migrated.`)
      setRoster((prev) =>
        prev.map((r) =>
          r.id === selectedRosterAthlete.id
            ? { ...r, auth_linked: true, linked_email: rosterEmail }
            : r
        )
      )
      setRosterResultCounts((prev) => ({ ...prev, [selectedRosterAthlete.id]: resultsCount }))
      setRosterModalOpen(false)
      setSelectedRosterAthlete(null)
      loadRosterStats()
    } catch (err) {
      console.error('Roster create error', err)
      setRosterMessage(err.message || 'Failed to create account')
    }
  }

  const renderRoster = () => (
    <div className="space-y-4">
      <div>
        <div className="text-lg font-semibold text-white">Athlete Roster Import</div>
        <div className="text-white/60 text-sm">Create accounts for athletes from the previous season.</div>
      </div>

      {rosterMessage && <div className="text-pfa-green text-sm">{rosterMessage}</div>}

      {renderRosterMetrics()}

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mt-2">
        <div className="flex gap-3">
          <input
            value={rosterSearch}
            onChange={(e) => setRosterSearch(e.target.value)}
            placeholder="Search name"
            className="bg-[#0d1a0e] border border-pfa-border rounded-lg px-3 py-2 text-sm text-white"
          />
          <select
            value={rosterSportFilter}
            onChange={(e) => setRosterSportFilter(e.target.value)}
            className="bg-[#0d1a0e] border border-pfa-border rounded-lg px-3 py-2 text-sm text-white"
          >
            <option value="All">All Sports</option>
            {SPORTS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-2 bg-[#0d1a0e] border border-pfa-border rounded-lg p-1 w-full md:w-auto">
          {['Pending', 'Linked Athletes'].map((tab) => {
            const active = rosterTab === tab
            return (
              <button
                key={tab}
                onClick={() => setRosterTab(tab)}
                className={`px-3 py-2 text-sm rounded-md ${active ? 'bg-pfa-green text-black' : 'text-white/70'}`}
              >
                {tab}
              </button>
            )
          })}
        </div>
      </div>

      {rosterTab === 'Pending'
        ? renderRosterTable(pendingRosterRows, false)
        : renderRosterTable(linkedRosterRows, true)}

      {rosterModalOpen && selectedRosterAthlete && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[#0d1a0e] border border-pfa-border rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-white font-semibold">Create Account</div>
                <div className="text-white/60 text-sm">{selectedRosterAthlete.full_name}</div>
              </div>
              <button onClick={() => setRosterModalOpen(false)} className="text-white/60 hover:text-white">
                ✕
              </button>
            </div>
            <div className="space-y-3">
              <input
                type="email"
                required
                value={rosterEmail}
                onChange={(e) => setRosterEmail(e.target.value)}
                placeholder="Email"
                className="w-full bg-[#0a0f0a] border border-pfa-border rounded-lg px-3 py-2 text-white"
              />
              <input
                type="password"
                required
                minLength={8}
                value={rosterPassword}
                onChange={(e) => setRosterPassword(e.target.value)}
                placeholder="Password"
                className="w-full bg-[#0a0f0a] border border-pfa-border rounded-lg px-3 py-2 text-white"
              />
              <button
                onClick={handleCreateAndLink}
                className="w-full bg-pfa-green text-black font-semibold py-2 rounded-lg"
              >
                Create & Link
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  const renderDashboard = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard label="Total Athletes" value={metrics.athletes} />
        <MetricCard label="Total Teams" value={metrics.teams} />
        <MetricCard label="Total Staff" value={metrics.staff} />
        <MetricCard label="Total Coaches" value={metrics.coaches} />
      </div>

      <SectionContainer>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Recent Users</h3>
          <div className="text-sm text-white/50">Last 10 created</div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-white/60">
              <tr className="border-b border-pfa-border">
                <th className="py-2 text-left">Name</th>
                <th className="py-2 text-left">Role</th>
                <th className="py-2 text-left">Sport</th>
                <th className="py-2 text-left">Team</th>
                <th className="py-2 text-left">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-pfa-border">
              {recentUsers.map((u) => (
                <tr key={u.id} className="hover:bg-white/5">
                  <td className="py-2">{u.full_name || u.email}</td>
                  <td className="py-2 capitalize">{u.role}</td>
                  <td className="py-2">{u.sport || '-'}</td>
                  <td className="py-2">{u.team_id || '-'}</td>
                  <td className="py-2 text-white/60">{u.created_at?.slice(0, 10) || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionContainer>
    </div>
  )

  const renderUsers = () => (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex gap-3">
          <input
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
            placeholder="Search name or email"
            className="bg-[#0d1a0e] border border-pfa-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-pfa-green"
          />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="bg-[#0d1a0e] border border-pfa-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-pfa-green"
          >
            {['All', 'pfa_admin', 'pfa_staff', 'team_coach', 'athlete', 'family'].map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={openCreateUser}
          className="bg-pfa-green text-black font-semibold px-4 py-2 rounded-lg hover:brightness-110 transition"
        >
          Create User
        </button>
      </div>

      <div className="overflow-x-auto bg-[#0d1a0e] border border-pfa-border rounded-xl">
        <table className="min-w-full text-sm">
          <thead className="text-white/60">
            <tr className="border-b border-pfa-border">
              <th className="py-3 px-3 text-left">Name</th>
              <th className="py-3 px-3 text-left">Email</th>
              <th className="py-3 px-3 text-left">Role</th>
              <th className="py-3 px-3 text-left">Sport</th>
              <th className="py-3 px-3 text-left">Team</th>
              <th className="py-3 px-3 text-left">Created</th>
              <th className="py-3 px-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-pfa-border">
            {usersLoading ? (
              <tr>
                <td className="py-3 px-3 text-white/60" colSpan={7}>
                  Loading...
                </td>
              </tr>
            ) : (
              filteredUsers.map((u) => (
                <tr key={u.id} className="hover:bg-white/5">
                  <td className="py-3 px-3">{u.full_name || '-'}</td>
                  <td className="py-3 px-3">{u.email}</td>
                  <td className="py-3 px-3 capitalize">{u.role}</td>
                  <td className="py-3 px-3">{u.sport || '-'}</td>
                  <td className="py-3 px-3">{u.team_id || '-'}</td>
                  <td className="py-3 px-3 text-white/60">{u.created_at?.slice(0, 10) || '-'}</td>
                  <td className="py-3 px-3 space-x-2">
                    <button
                      onClick={() => openEditUser(u)}
                      className="text-pfa-green hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteUser(u.id)}
                      className="text-red-400 hover:underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {userModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[#0d1a0e] border border-pfa-border rounded-xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">{editingUser ? 'Edit User' : 'Create User'}</h3>
              <button onClick={() => setUserModalOpen(false)} className="text-white/60 hover:text-white">
                ✕
              </button>
            </div>
            {userActionMessage && <div className="mb-3 text-pfa-green text-sm">{userActionMessage}</div>}
            <form className="grid grid-cols-1 md:grid-cols-2 gap-4" onSubmit={handleUserSubmit}>
              <input
                required
                value={userForm.full_name}
                onChange={(e) => setUserForm({ ...userForm, full_name: e.target.value })}
                placeholder="Full Name"
                className="bg-[#0a0f0a] border border-pfa-border rounded-lg px-3 py-2 text-white"
              />
              <input
                required
                type="email"
                value={userForm.email}
                onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                placeholder="Email"
                className="bg-[#0a0f0a] border border-pfa-border rounded-lg px-3 py-2 text-white"
              />
              {!editingUser && (
                <input
                  required
                  minLength={8}
                  type="password"
                  value={userForm.password}
                  onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                  placeholder="Password"
                  className="bg-[#0a0f0a] border border-pfa-border rounded-lg px-3 py-2 text-white"
                />
              )}
              <select
                value={userForm.role}
                onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                className="bg-[#0a0f0a] border border-pfa-border rounded-lg px-3 py-2 text-white"
              >
                {['pfa_staff', 'team_coach', 'athlete', 'family'].map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <select
                value={userForm.sport}
                onChange={(e) => setUserForm({ ...userForm, sport: e.target.value })}
                className="bg-[#0a0f0a] border border-pfa-border rounded-lg px-3 py-2 text-white"
              >
                {SPORTS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <input
                value={userForm.position}
                onChange={(e) => setUserForm({ ...userForm, position: e.target.value })}
                placeholder="Position"
                className="bg-[#0a0f0a] border border-pfa-border rounded-lg px-3 py-2 text-white"
              />
              <input
                type="date"
                value={userForm.date_of_birth}
                onChange={(e) => setUserForm({ ...userForm, date_of_birth: e.target.value })}
                className="bg-[#0a0f0a] border border-pfa-border rounded-lg px-3 py-2 text-white"
              />
              <select
                value={userForm.gender}
                onChange={(e) => setUserForm({ ...userForm, gender: e.target.value })}
                className="bg-[#0a0f0a] border border-pfa-border rounded-lg px-3 py-2 text-white"
              >
                {['male', 'female', 'other'].map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
              <input
                value={userForm.age_category}
                onChange={(e) => setUserForm({ ...userForm, age_category: e.target.value })}
                placeholder="Age Category"
                className="bg-[#0a0f0a] border border-pfa-border rounded-lg px-3 py-2 text-white"
              />
              <input
                value={userForm.competition_level}
                onChange={(e) => setUserForm({ ...userForm, competition_level: e.target.value })}
                placeholder="Competition Level"
                className="bg-[#0a0f0a] border border-pfa-border rounded-lg px-3 py-2 text-white"
              />
              <select
                value={userForm.team_id}
                onChange={(e) => setUserForm({ ...userForm, team_id: e.target.value })}
                className="bg-[#0a0f0a] border border-pfa-border rounded-lg px-3 py-2 text-white"
              >
                <option value="">No Team</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              {userForm.role === 'family' && (
                <input
                  value={userForm.linked_athlete_id}
                  onChange={(e) => setUserForm({ ...userForm, linked_athlete_id: e.target.value })}
                  placeholder="Linked Athlete ID"
                  className="bg-[#0a0f0a] border border-pfa-border rounded-lg px-3 py-2 text-white"
                />
              )}
              <div className="md:col-span-2 flex justify-end gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => setUserModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-pfa-border text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-pfa-green text-black font-semibold hover:brightness-110"
                >
                  {editingUser ? 'Save Changes' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )

  const renderTeams = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Teams</h3>
        <button
          onClick={openCreateTeam}
          className="bg-pfa-green text-black font-semibold px-4 py-2 rounded-lg hover:brightness-110 transition"
        >
          Create Team
        </button>
      </div>
      <div className="overflow-x-auto bg-[#0d1a0e] border border-pfa-border rounded-xl">
        <table className="min-w-full text-sm">
          <thead className="text-white/60">
            <tr className="border-b border-pfa-border">
              <th className="py-3 px-3 text-left">Name</th>
              <th className="py-3 px-3 text-left">Sport</th>
              <th className="py-3 px-3 text-left">Age Category</th>
              <th className="py-3 px-3 text-left">Competition</th>
              <th className="py-3 px-3 text-left">Primary</th>
              <th className="py-3 px-3 text-left">Season</th>
              <th className="py-3 px-3 text-left">Coach</th>
              <th className="py-3 px-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-pfa-border">
            {teamsLoading ? (
              <tr>
                <td className="py-3 px-3 text-white/60" colSpan={8}>
                  Loading...
                </td>
              </tr>
            ) : (
              teams.map((t) => (
                <tr key={t.id} className="hover:bg-white/5">
                  <td className="py-3 px-3">{t.name}</td>
                  <td className="py-3 px-3">{t.sport}</td>
                  <td className="py-3 px-3">{t.age_category || '-'}</td>
                  <td className="py-3 px-3">{t.competition_level || '-'}</td>
                  <td className="py-3 px-3">
                    <span
                      className="inline-block w-6 h-6 rounded-full border border-pfa-border"
                      style={{ backgroundColor: t.primary_color || '#3fae52' }}
                    />
                  </td>
                  <td className="py-3 px-3">{t.season || '-'}</td>
                  <td className="py-3 px-3">{t.coach_id || '-'}</td>
                  <td className="py-3 px-3 space-x-2">
                    <button
                      onClick={() => openEditTeam(t)}
                      className="text-pfa-green hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteTeam(t.id)}
                      className="text-red-400 hover:underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {teamModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[#0d1a0e] border border-pfa-border rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">{editingTeam ? 'Edit Team' : 'Create Team'}</h3>
              <button onClick={() => setTeamModalOpen(false)} className="text-white/60 hover:text-white">
                ✕
              </button>
            </div>
            <form className="grid grid-cols-1 md:grid-cols-2 gap-4" onSubmit={handleTeamSubmit}>
              <input
                required
                value={teamForm.name}
                onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })}
                placeholder="Team Name"
                className="bg-[#0a0f0a] border border-pfa-border rounded-lg px-3 py-2 text-white"
              />
              <select
                value={teamForm.sport}
                onChange={(e) => setTeamForm({ ...teamForm, sport: e.target.value })}
                className="bg-[#0a0f0a] border border-pfa-border rounded-lg px-3 py-2 text-white"
              >
                {SPORTS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <input
                value={teamForm.age_category}
                onChange={(e) => setTeamForm({ ...teamForm, age_category: e.target.value })}
                placeholder="Age Category"
                className="bg-[#0a0f0a] border border-pfa-border rounded-lg px-3 py-2 text-white"
              />
              <input
                value={teamForm.competition_level}
                onChange={(e) => setTeamForm({ ...teamForm, competition_level: e.target.value })}
                placeholder="Competition Level"
                className="bg-[#0a0f0a] border border-pfa-border rounded-lg px-3 py-2 text-white"
              />
              <div className="flex items-center gap-2">
                <span className="text-white/70 text-sm">Primary</span>
                <input
                  type="color"
                  value={teamForm.primary_color}
                  onChange={(e) => setTeamForm({ ...teamForm, primary_color: e.target.value })}
                  className="bg-[#0a0f0a] border border-pfa-border rounded-lg w-full h-10"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-white/70 text-sm">Secondary</span>
                <input
                  type="color"
                  value={teamForm.secondary_color}
                  onChange={(e) => setTeamForm({ ...teamForm, secondary_color: e.target.value })}
                  className="bg-[#0a0f0a] border border-pfa-border rounded-lg w-full h-10"
                />
              </div>
              <input
                value={teamForm.season}
                onChange={(e) => setTeamForm({ ...teamForm, season: e.target.value })}
                placeholder="Season (e.g. 2024-2025)"
                className="bg-[#0a0f0a] border border-pfa-border rounded-lg px-3 py-2 text-white"
              />
              <input
                value={teamForm.coach_id}
                onChange={(e) => setTeamForm({ ...teamForm, coach_id: e.target.value })}
                placeholder="Coach ID"
                className="bg-[#0a0f0a] border border-pfa-border rounded-lg px-3 py-2 text-white"
              />
              <div className="md:col-span-2 flex justify-end gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => setTeamModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-pfa-border text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-pfa-green text-black font-semibold hover:brightness-110"
                >
                  {editingTeam ? 'Save Changes' : 'Create Team'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )

  const renderAthletes = () => (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex gap-3">
          <input
            value={athleteSearch}
            onChange={(e) => setAthleteSearch(e.target.value)}
            placeholder="Search athlete"
            className="bg-[#0d1a0e] border border-pfa-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-pfa-green"
          />
          <select
            value={athleteSportFilter}
            onChange={(e) => setAthleteSportFilter(e.target.value)}
            className="bg-[#0d1a0e] border border-pfa-border rounded-lg px-3 py-2 text-sm text-white"
          >
            <option value="All">All Sports</option>
            {SPORTS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            value={athleteTeamFilter}
            onChange={(e) => setAthleteTeamFilter(e.target.value)}
            className="bg-[#0d1a0e] border border-pfa-border rounded-lg px-3 py-2 text-sm text-white"
          >
            <option value="All">All Teams</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto bg-[#0d1a0e] border border-pfa-border rounded-xl">
        <table className="min-w-full text-sm">
          <thead className="text-white/60">
            <tr className="border-b border-pfa-border">
              <th className="py-3 px-3 text-left">Name</th>
              <th className="py-3 px-3 text-left">Sport</th>
              <th className="py-3 px-3 text-left">Position</th>
              <th className="py-3 px-3 text-left">Team</th>
              <th className="py-3 px-3 text-left">Age Category</th>
              <th className="py-3 px-3 text-left">Competition</th>
              <th className="py-3 px-3 text-left">DOB</th>
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
              filteredAthletes.map((a) => (
                <React.Fragment key={a.id}>
                  <tr
                    className="hover:bg-white/5 cursor-pointer"
                    onClick={() => {
                      const nextId = expandedAthleteId === a.id ? null : a.id
                      setExpandedAthleteId(nextId)
                      if (nextId) loadAthleteTeams(a.id)
                    }}
                  >
                    <td className="py-3 px-3">{a.full_name}</td>
                    <td className="py-3 px-3">{a.sport}</td>
                    <td className="py-3 px-3">{a.position || '-'}</td>
                    <td className="py-3 px-3">{a.team_id || '-'}</td>
                    <td className="py-3 px-3">{a.age_category || '-'}</td>
                    <td className="py-3 px-3">{a.competition_level || '-'}</td>
                    <td className="py-3 px-3">{a.date_of_birth?.slice(0, 10) || '-'}</td>
                  </tr>
                  {expandedAthleteId === a.id && (
                    <tr className="bg-white/5">
                      <td colSpan={7} className="py-3 px-3 text-sm text-white/80">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div>Gender: {a.gender || '-'}</div>
                          <div>Linked Family: {a.linked_family_id || '-'}</div>
                          <div>Linked Athlete: {a.linked_athlete_id || '-'}</div>
                          <div>Updated: {a.updated_at?.slice(0, 10) || '-'}</div>
                          <div>Created: {a.created_at?.slice(0, 10) || '-'}</div>
                          <div>Position: {a.position || '-'}</div>
                        </div>
                        <div className="mt-4 space-y-2">
                          <div className="text-white font-semibold">Teams & Groups</div>
                          <div className="flex flex-wrap gap-2">
                            {(athleteTeamsMap[a.id] || []).map((t) => (
                              <div
                                key={t.id || t.team_id}
                                className="flex items-center gap-2 bg-[#0a0f0a] border border-pfa-border rounded-lg px-3 py-2"
                              >
                                <div className="text-sm text-white/80">
                                  {t.pfa_teams?.name || t.name}
                                  {t.pfa_teams?.sport ? ` • ${t.pfa_teams.sport}` : ''}
                                  {t.pfa_teams?.age_category ? ` • ${t.pfa_teams.age_category}` : ''}
                                </div>
                                <button
                                  className="text-red-400 text-xs"
                                  onClick={async (e) => {
                                    e.stopPropagation()
                                    await removeAthleteFromTeam(a.id, t.team_id || t.id)
                                    const updated = await getAthleteTeams(a.id)
                                    setAthleteTeamsMap((prev) => ({ ...prev, [a.id]: updated || [] }))
                                  }}
                                >
                                  Remove
                                </button>
                              </div>
                            ))}
                          </div>
                          <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                            <select
                              value={athleteTeamSelect[a.id] || ''}
                              onChange={(e) =>
                                setAthleteTeamSelect((prev) => ({ ...prev, [a.id]: e.target.value }))
                              }
                              className="bg-[#0a0f0a] border border-pfa-border rounded-lg px-3 py-2 text-white"
                            >
                              <option value="">Select team/group</option>
                              {teams.map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.name}
                                  {t.sport ? ` • ${t.sport}` : ''}
                                  {t.age_category ? ` • ${t.age_category}` : ''}
                                </option>
                              ))}
                            </select>
                            <button
                              className="px-3 py-2 rounded-lg bg-pfa-green text-black text-sm font-semibold"
                              onClick={async (e) => {
                                e.stopPropagation()
                                const teamId = athleteTeamSelect[a.id]
                                if (!teamId) return
                                await addAthleteToTeam(a.id, teamId)
                                const updated = await getAthleteTeams(a.id)
                                setAthleteTeamsMap((prev) => ({ ...prev, [a.id]: updated || [] }))
                                setAthleteTeamSelect((prev) => ({ ...prev, [a.id]: '' }))
                              }}
                            >
                              Add to Team/Group
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )

  const renderSettings = () => (
    <SectionContainer>
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-lg font-semibold text-white">{profile?.full_name || 'Admin'}</div>
          <div className="text-white/60">{user?.email}</div>
          <div className="text-white/60 capitalize">{profile?.role}</div>
        </div>
        <div className="flex gap-2">
          <input
            type="password"
            value={passwordChange}
            onChange={(e) => setPasswordChange(e.target.value)}
            placeholder="New password"
            className="bg-[#0a0f0a] border border-pfa-border rounded-lg px-3 py-2 text-white"
          />
          <button
            onClick={handlePasswordChange}
            className="bg-pfa-green text-black font-semibold px-4 py-2 rounded-lg hover:brightness-110"
          >
            Change Password
          </button>
        </div>
      </div>
      {passwordMessage && <div className="text-pfa-green text-sm">{passwordMessage}</div>}
    </SectionContainer>
  )

  const renderSection = () => {
    switch (activeSection) {
      case 'Dashboard':
        return renderDashboard()
      case 'Users':
        return renderUsers()
      case 'Teams':
        return renderTeams()
      case 'Athletes':
        return renderAthletes()
      case 'Roster':
        return renderRoster()
      case 'Settings':
        return renderSettings()
      default:
        return null
    }
  }

  return (
    <DashboardLayout>
      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
        <aside className="bg-[#0d1a0e] border border-pfa-border rounded-xl p-4 h-max">
          <div className="flex items-center justify-between mb-6">
            <div className="text-sm font-semibold tracking-wide text-pfa-green">PEAK FITNESS ATHLETICS</div>
            <button
              onClick={signOut}
              className="text-white/60 hover:text-white text-sm"
            >
              Sign Out
            </button>
          </div>
          <div className="space-y-1">
            {sectionList.map((item) => {
              const active = activeSection === item
              return (
                <button
                  key={item}
                  onClick={() => setActiveSection(item)}
                  className={`${navItemBase} w-full text-left border border-transparent ${
                    active ? 'border-l-4 border-pfa-green text-pfa-green bg-white/5' : 'text-white/60'
                  }`}
                >
                  {item}
                </button>
              )
            })}
          </div>
        </aside>

        <main className="space-y-6">
          <div className="bg-[#0d1a0e] border border-pfa-border rounded-xl p-4 flex items-center justify-between">
            <div className="text-lg font-semibold text-white">{activeSection}</div>
            <div className="text-sm text-white/60">{profile?.full_name || 'Rick Leger'} — Admin</div>
          </div>
          {renderSection()}
        </main>
      </div>
    </DashboardLayout>
  )
}

export default Admin
