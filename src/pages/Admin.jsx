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
  saveBodyMeasurement,
  getAthleteRecentMeasurements,
} from '../services/athletes'
import { getAllTeams, createTeam, updateTeam, getTeamRoster } from '../services/teams'
import {
  createUser as createAdminUser,
  deleteUser as deleteAdminUser,
  updateUser as updateAdminUser,
  createAndLinkAthlete,
} from '../services/adminUsers'
import { SPORTS } from '../constants/sports'
import { formatRole } from '../utils/formatRole'

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
  const [expandedTeamId, setExpandedTeamId] = useState(null)
  const [teamForm, setTeamForm] = useState({
    name: '',
    sport: SPORTS[0],
    age_category: '',
    competition_level: '',
    primary_color: '#3fae52',
    secondary_color: '#ffffff',
    coach_id: '',
  })
  const [teamCoachOptions, setTeamCoachOptions] = useState([])
  const [teamRosterMap, setTeamRosterMap] = useState({})
  const [teamAthleteOptions, setTeamAthleteOptions] = useState([])
  const [teamAddAthleteSelect, setTeamAddAthleteSelect] = useState('')
  const [teamAddAthleteSearch, setTeamAddAthleteSearch] = useState('')
  const [pendingTeamForNewAthlete, setPendingTeamForNewAthlete] = useState(null)
  const [forceAthleteRole, setForceAthleteRole] = useState(false)
  const [selectedTeamAthletes, setSelectedTeamAthletes] = useState([])

  const [athletes, setAthletes] = useState([])
  const [athletesLoading, setAthletesLoading] = useState(false)
  const [athleteSearch, setAthleteSearch] = useState('')
  const [athleteSportFilter, setAthleteSportFilter] = useState('All')
  const [athleteTeamFilter, setAthleteTeamFilter] = useState('All')
  const [expandedAthleteId, setExpandedAthleteId] = useState(null)
  const [athleteTeamsMap, setAthleteTeamsMap] = useState({})
  const [athleteTeamSelect, setAthleteTeamSelect] = useState({})
  const [athleteResultsMap, setAthleteResultsMap] = useState({})

  const [measurementSearch, setMeasurementSearch] = useState('')
  const [selectedMeasurementAthlete, setSelectedMeasurementAthlete] = useState(null)
  const [recentMeasurements, setRecentMeasurements] = useState([])
  const todayStr = () => new Date().toISOString().slice(0, 10)
  const [measurementForm, setMeasurementForm] = useState({
    date: todayStr(),
    height: '',
    weight: '',
    bodyFat: '',
    muscleMass: '',
  })
  const [measurementMessage, setMeasurementMessage] = useState('')

  const [roster, setRoster] = useState([])
  const [rosterLoading, setRosterLoading] = useState(false)
  const [rosterStats, setRosterStats] = useState({ total: 0, linked: 0, pending: 0, results: 0 })
  const [rosterSearch, setRosterSearch] = useState('')
  const [rosterSportFilter, setRosterSportFilter] = useState('All')
  const [rosterTab, setRosterTab] = useState('All')
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
      .filter((u) => u.full_name?.toLowerCase().includes(term) || u.email?.toLowerCase().includes(term))
  }, [users, userSearch, roleFilter])

  const inchesToFtIn = (inches) => {
    if (!inches) return '—'
    const ft = Math.floor(inches / 12)
    const ins = Math.round(inches % 12)
    return `${ft}'${ins}`
  }

  const SPORT_OPTIONS = useMemo(() => {
    const list = [...SPORTS]
    if (!list.includes('Ringette')) list.push('Ringette')
    return list.sort((a, b) => a.localeCompare(b))
  }, [])

  const AGE_CATEGORIES_BY_SPORT = {
    Hockey: ['U11', 'U13', 'U14', 'U15', 'U16', 'U18', 'U19', 'Junior', 'Senior'],
    Soccer: ['U13', 'U14', 'U15', 'U16', 'U17', 'U18', 'U19', 'University', 'Senior'],
    Volleyball: ['U14', 'U16', 'U18', 'University', 'Senior'],
  }

  const DEFAULT_AGE_CATEGORIES = ['U13', 'U14', 'U15', 'U16', 'U17', 'U18', 'U19', 'University', 'Senior']

  const getAgeCategories = (sport) => AGE_CATEGORIES_BY_SPORT[sport] || DEFAULT_AGE_CATEGORIES

  const POSITIONS_BY_SPORT = {
    Hockey: ['Center', 'Left Wing', 'Right Wing', 'Defense', 'Goalie'],
    Soccer: ['Goalkeeper', 'Defender', 'Midfielder', 'Forward'],
    Basketball: ['Point Guard', 'Shooting Guard', 'Small Forward', 'Power Forward', 'Center'],
    Volleyball: ['Setter', 'Outside Hitter', 'Middle Blocker', 'Libero', 'Opposite Hitter'],
    Ringette: ['Center', 'Wing', 'Defense', 'Goalie'],
  }

  const DEFAULT_POSITIONS = ['Forward', 'Defense', 'Midfielder', 'Goalie', 'Other']

  const getPositions = (sport) => POSITIONS_BY_SPORT[sport] || DEFAULT_POSITIONS

  const availableTeamAthletes = useMemo(() => {
    if (!editingTeam) return []
    const current = (teamRosterMap[editingTeam.id] || []).map((r) => r.athlete_id)
    return teamAthleteOptions.filter((a) => !current.includes(a.id)).filter((a) =>
      a.full_name.toLowerCase().includes(teamAddAthleteSearch.toLowerCase())
    )
  }, [editingTeam, teamRosterMap, teamAthleteOptions, teamAddAthleteSearch])

  const loadRecentBodyMeasurements = async (athleteId) => {
    if (!athleteId) return
    const data = await getAthleteRecentMeasurements(athleteId)
    setRecentMeasurements(data.slice(0, 3))
  }

  const handleSaveMeasurement = async (e) => {
    e.preventDefault()
    if (!selectedMeasurementAthlete) return
    try {
      await saveBodyMeasurement({
        athleteId: selectedMeasurementAthlete.id,
        date: measurementForm.date || todayStr(),
        height: measurementForm.height || null,
        weight: measurementForm.weight || null,
        bodyFat: measurementForm.bodyFat || null,
        muscleMass: measurementForm.muscleMass || null,
      })
      setMeasurementMessage('Measurement saved')
      setMeasurementForm({ ...measurementForm, date: todayStr() })
      loadRecentBodyMeasurements(selectedMeasurementAthlete.id)
    } catch (err) {
      setMeasurementMessage(err.message || 'Failed to save measurement')
    }
  }

  const renderMeasurements = () => (
    <div className="space-y-4">
      <div className="bg-[#0d1a0e] border border-pfa-border rounded-xl p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="text-lg font-semibold text-white">Body Measurements</div>
            <div className="text-white/60 text-sm">Enter height, weight, and composition per season.</div>
          </div>
          {measurementMessage && <div className="text-pfa-green text-sm">{measurementMessage}</div>}
        </div>

        <div className="flex flex-col md:flex-row gap-3 md:items-center">
          <input
            value={measurementSearch}
            onChange={(e) => setMeasurementSearch(e.target.value)}
            placeholder="Search athlete"
            className="bg-[#0a0f0a] border border-pfa-border rounded-lg px-3 py-2 text-sm text-white w-full md:w-72"
          />
          <select
            value={selectedMeasurementAthlete?.id || ''}
            onChange={(e) => {
              const athlete = athletes.find((a) => a.id === e.target.value)
              setSelectedMeasurementAthlete(athlete || null)
              setMeasurementMessage('')
              if (athlete) loadRecentBodyMeasurements(athlete.id)
            }}
            className="bg-[#0a0f0a] border border-pfa-border rounded-lg px-3 py-2 text-sm text-white w-full md:w-72"
          >
            <option value="">Select athlete</option>
            {filteredMeasurementAthletes.map((a) => (
              <option key={a.id} value={a.id}>
                {a.full_name}
              </option>
            ))}
          </select>
        </div>

        {selectedMeasurementAthlete && (
          <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-4">
            <div className="bg-[#0a0f0a] border border-pfa-border rounded-lg p-4 space-y-3">
              <div className="text-white font-semibold mb-2">New Measurement</div>
              <form className="space-y-3" onSubmit={handleSaveMeasurement}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-white/60">Date</label>
                    <input
                      type="date"
                      value={measurementForm.date}
                      onChange={(e) => setMeasurementForm({ ...measurementForm, date: e.target.value })}
                      className="bg-[#0d1a0e] border border-pfa-border rounded-lg px-3 py-2 text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-white/60">Height (inches)</label>
                    <input
                      type="number"
                      step="0.5"
                      placeholder="e.g. 71 for 5'11 inches"
                      value={measurementForm.height}
                      onChange={(e) => setMeasurementForm({ ...measurementForm, height: e.target.value })}
                      className="bg-[#0d1a0e] border border-pfa-border rounded-lg px-3 py-2 text-white"
                    />
                    <div className="text-xs text-white/50">{measurementForm.height ? inchesToFtIn(parseFloat(measurementForm.height)) : '—'}</div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-white/60">Weight (lbs)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={measurementForm.weight}
                      onChange={(e) => setMeasurementForm({ ...measurementForm, weight: e.target.value })}
                      className="bg-[#0d1a0e] border border-pfa-border rounded-lg px-3 py-2 text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-white/60">Body Fat %</label>
                    <input
                      type="number"
                      step="0.1"
                      value={measurementForm.bodyFat}
                      onChange={(e) => setMeasurementForm({ ...measurementForm, bodyFat: e.target.value })}
                      className="bg-[#0d1a0e] border border-pfa-border rounded-lg px-3 py-2 text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-white/60">Muscle Mass (lbs)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={measurementForm.muscleMass}
                      onChange={(e) => setMeasurementForm({ ...measurementForm, muscleMass: e.target.value })}
                      className="bg-[#0d1a0e] border border-pfa-border rounded-lg px-3 py-2 text-white"
                    />
                    <div className="text-xs text-white/50">Optional</div>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button type="submit" className="bg-pfa-green text-black font-semibold px-4 py-2 rounded-lg hover:brightness-110">
                    Save Measurement
                  </button>
                </div>
              </form>
            </div>

            <div className="bg-[#0a0f0a] border border-pfa-border rounded-lg p-4">
              <div className="text-white font-semibold mb-2">Recent Measurements (last 3)</div>
              {recentMeasurements.length === 0 ? (
                <div className="text-white/60 text-sm">No measurements yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm" style={{ tableLayout: 'fixed', width: '100%' }}>
                    <thead className="text-white/60">
                      <tr className="border-b border-pfa-border">
                        <th className="py-2 text-left">Date</th>
                        <th className="py-2 text-left">Height</th>
                        <th className="py-2 text-left">Weight</th>
                        <th className="py-2 text-left">Body Fat</th>
                        <th className="py-2 text-left">Muscle</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-pfa-border">
                      {recentMeasurements.map((m) => (
                        <tr key={m.id}>
                          <td className="py-2">{m.measurement_date?.slice(0, 10) || '-'}</td>
                          <td className="py-2">{m.height ? inchesToFtIn(m.height) : '—'}</td>
                          <td className="py-2">{m.weight ? `${m.weight} lbs` : '—'}</td>
                          <td className="py-2">{m.body_fat_percentage != null ? `${m.body_fat_percentage}%` : '—'}</td>
                          <td className="py-2">{m.muscle_mass != null ? `${m.muscle_mass} lbs` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )

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

  const filteredMeasurementAthletes = useMemo(() => {
    const term = measurementSearch.toLowerCase()
    return athletes.filter((a) => a.full_name?.toLowerCase().includes(term))
  }, [athletes, measurementSearch])

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
      .select('*, pfa_teams(name)')
      .order('created_at', { ascending: false })
      .limit(10)
    if (!error) setRecentUsers(data || [])
  }

  const loadUsers = async () => {
    setUsersLoading(true)
    const { data, error } = await supabase
      .from('profiles')
      .select('*, pfa_teams(name)')
      .order('created_at', { ascending: false })
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

  const loadAthleteResults = async (athleteId) => {
    try {
      const { data, error } = await supabase
        .from('pfa_test_results')
        .select('id, test_type, value, unit, category, date_tested, test_sessions(test_category)')
        .eq('athlete_id', athleteId)
        .order('date_tested', { ascending: false })
        .limit(100)
      if (!error) {
        setAthleteResultsMap((prev) => ({ ...prev, [athleteId]: data || [] }))
      }
    } catch (err) {
      console.error('Athlete results load error', err)
    }
  }

  const groupResultsByCategory = (rows = []) => {
    if (!rows || !Array.isArray(rows)) return {}
    return rows.reduce((acc, r) => {
      const cat = (r.category || r.test_sessions?.test_category || 'Other').toUpperCase()
      if (!acc[cat]) acc[cat] = []
      acc[cat].push(r)
      return acc
    }, {})
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
    setForceAthleteRole(false)
    setEditingUser(null)
    setUserForm({
      full_name: '',
      email: '',
      password: '',
      role: 'pfa_staff',
      sport: SPORTS[0],
      position: '',
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
      let createdUserId = null
      const sanitizedUser = {
        ...userForm,
        team_id: userForm.team_id || null,
        linked_athlete_id: userForm.linked_athlete_id || null,
      }

      if (editingUser) {
        await updateAdminUser(editingUser.id, sanitizedUser)
        setUserActionMessage('User updated')
      } else {
        const newUser = await createAdminUser(sanitizedUser)
        createdUserId = newUser?.id
        setUserActionMessage('User created')
      }
      setUserModalOpen(false)
      loadUsers()
      loadMetrics()

      if (createdUserId && pendingTeamForNewAthlete?.id && sanitizedUser.role === 'athlete') {
        await supabase.from('athlete_teams').insert({ team_id: pendingTeamForNewAthlete.id, athlete_id: createdUserId })
        await loadTeamRoster(pendingTeamForNewAthlete.id)
        openEditTeam(pendingTeamForNewAthlete)
      }
      setPendingTeamForNewAthlete(null)
      setForceAthleteRole(false)
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
      coach_id: '',
    })
    loadTeamCoaches()
    loadAllAthletesForTeams()
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
      coach_id: teamRow.coach_id || '',
    })
    loadTeamCoaches()
    loadAllAthletesForTeams()
    if (teamRow?.id) loadTeamRoster(teamRow.id)
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

  const loadTeamCoaches = async () => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('role', 'team_coach')
        .order('full_name')
      setTeamCoachOptions(data || [])
    } catch (err) {
      console.error('Load team coaches failed', err)
    }
  }

  const loadAllAthletesForTeams = async () => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, sport, position, age_category')
        .eq('role', 'athlete')
        .order('full_name')
      setTeamAthleteOptions(data || [])
    } catch (err) {
      console.error('Load athletes for team modal failed', err)
    }
  }

  const loadTeamRoster = async (teamId) => {
    if (!teamId) return
    try {
      const { data, error } = await supabase
        .from('athlete_teams')
        .select('athlete_id, profiles(full_name, sport, position, age_category)')
        .eq('team_id', teamId)
        .order('profiles(full_name)')
      if (!error) {
        setTeamRosterMap((prev) => ({ ...prev, [teamId]: data || [] }))
      }
    } catch (err) {
      console.error('Load team roster failed', err)
    }
  }

  const removeAthleteFromTeam = async (teamId, athleteId) => {
    try {
      await supabase.from('athlete_teams').delete().eq('team_id', teamId).eq('athlete_id', athleteId)
      loadTeamRoster(teamId)
    } catch (err) {
      console.error('Remove athlete from team failed', err)
    }
  }

  const addExistingAthleteToTeam = async (teamId, athleteId) => {
    if (!teamId || !athleteId) return
    try {
      await supabase.from('athlete_teams').insert({ team_id: teamId, athlete_id: athleteId })
      setTeamAddAthleteSelect('')
      loadTeamRoster(teamId)
    } catch (err) {
      console.error('Add athlete to team failed', err)
    }
  }

  // Previous button behavior closed the team modal and set flags but sometimes skipped opening the create user modal:
  // onClick={() => { if (!editingTeam?.id) return; setTeamModalOpen(false); setPendingTeamForNewAthlete(editingTeam); setForceAthleteRole(true); setUserForm(...); setUserModalOpen(true) }}
  const handleCreateAndAddAthlete = (team) => {
    setPendingTeamForNewAthlete(team)
    setForceAthleteRole(true)
    setUserForm({
      full_name: '',
      email: '',
      password: '',
      role: 'athlete',
      sport: '',
      age_category: '',
      position: '',
      gender: 'male',
      competition_level: '',
      team_id: '',
    })
    setEditingTeam(null)
    setTeamModalOpen(false)
    setUserModalOpen(true)
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
              <th className="py-3 px-3 text-left">Status</th>
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
              <th className="py-3 px-3 text-left">Status</th>
              <th className="py-3 px-3 text-left">Action</th>
            </tr>
          )}
        </thead>
        <tbody className="divide-y divide-pfa-border">
          {rosterLoading ? (
            <tr>
              <td className="py-3 px-3 text-white/60" colSpan={linkedView ? 5 : 9}>
                Loading...
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td className="py-3 px-3 text-white/60" colSpan={linkedView ? 5 : 9}>
                No athletes found.
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              (() => {
                const status = (r.status || (r.auth_linked ? 'linked' : 'pending')).toLowerCase()
                const isPending = status === 'pending'
                const statusStyles = isPending
                  ? { background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }
                  : { background: 'rgba(63,174,82,0.1)', color: '#3fae52' }
                return (
                  <tr
                    key={r.id}
                    className="hover:bg-white/5"
                    style={
                      isPending
                        ? { background: 'rgba(245,158,11,0.05)', borderLeft: '3px solid #f59e0b' }
                        : undefined
                    }
                  >
                    <td className="py-3 px-3 text-white">{r.full_name}</td>
                {linkedView ? (
                  <>
                    <td className="py-3 px-3">{r.linked_email || r.email || '-'}</td>
                    <td className="py-3 px-3">{r.sport || '-'}</td>
                    <td className="py-3 px-3 text-pfa-green font-semibold">
                      {rosterResultCounts[r.id] ?? 0}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        style={{
                          fontSize: '11px',
                          padding: '4px 10px',
                          borderRadius: '999px',
                          fontWeight: 700,
                          background: statusStyles.background,
                          color: statusStyles.color,
                        }}
                      >
                        {isPending ? 'Pending' : 'Linked'}
                      </span>
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
                      <span
                        style={{
                          fontSize: '11px',
                          padding: '4px 10px',
                          borderRadius: '999px',
                          fontWeight: 700,
                          background: statusStyles.background,
                          color: statusStyles.color,
                        }}
                      >
                        {isPending ? 'Pending' : 'Linked'}
                      </span>
                    </td>
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
                )
              })()
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
            {SPORT_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-2 bg-[#0d1a0e] border border-pfa-border rounded-lg p-1 w-full md:w-auto">
          {['All', 'Pending', 'Linked Athletes'].map((tab) => {
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
        : rosterTab === 'Linked Athletes'
        ? renderRosterTable(linkedRosterRows, true)
        : renderRosterTable(filteredRoster, false)}

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
                  <td className="py-2">{formatRole(u.role)}</td>
                  <td className="py-2">{u.sport || '-'}</td>
                  <td className="py-2">{u.pfa_teams?.name || '-'}</td>
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
                  <td className="py-3 px-3">{formatRole(u.role)}</td>
                  <td className="py-3 px-3">{u.sport || '-'}</td>
                  <td className="py-3 px-3">{u.pfa_teams?.name || '-'}</td>
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
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 overflow-x-hidden">
          <div
            className="bg-[#0d1a0e] border border-pfa-border rounded-xl p-6 w-full max-h-[90vh] overflow-y-auto overflow-x-hidden"
            style={{ maxWidth: '672px', boxSizing: 'border-box' }}
          >
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
                disabled={forceAthleteRole}
              >
                {['pfa_staff', 'team_coach', 'athlete', 'family'].map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <select
                value={userForm.sport}
                onChange={(e) => setUserForm({ ...userForm, sport: e.target.value, age_category: '', position: '' })}
                className="bg-[#0a0f0a] border border-pfa-border rounded-lg px-3 py-2 text-white"
              >
                {SPORT_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <select
                value={userForm.age_category}
                onChange={(e) => setUserForm({ ...userForm, age_category: e.target.value })}
                className="bg-[#0a0f0a] border border-pfa-border rounded-lg px-3 py-2 text-white"
              >
                <option value="">Age Category</option>
                {getAgeCategories(userForm.sport).map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              <select
                value={userForm.position}
                onChange={(e) => setUserForm({ ...userForm, position: e.target.value })}
                className="bg-[#0a0f0a] border border-pfa-border rounded-lg px-3 py-2 text-white"
              >
                <option value="">Position</option>
                {getPositions(userForm.sport).map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
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
              <select
                value={userForm.competition_level}
                onChange={(e) => setUserForm({ ...userForm, competition_level: e.target.value })}
                className="bg-[#0a0f0a] border border-pfa-border rounded-lg px-3 py-2 text-white"
              >
                <option value="">Competition Level</option>
                {['Pro', 'Semi-Pro', 'University', 'Junior', 'AAA', 'AA', 'A', 'Recreational'].map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {lvl}
                  </option>
                ))}
              </select>
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
              <th className="py-3 px-3 text-left">Coach</th>
              <th className="py-3 px-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-pfa-border">
            {teamsLoading ? (
              <tr>
                <td className="py-3 px-3 text-white/60" colSpan={7}>
                  Loading...
                </td>
              </tr>
            ) : (
              teams.map((t) => (
                <React.Fragment key={t.id}>
                  <tr
                    className="hover:bg-white/5 cursor-pointer"
                    onClick={() => {
                      const next = expandedTeamId === t.id ? null : t.id
                      setExpandedTeamId(next)
                      if (next) loadTeamRoster(t.id)
                    }}
                  >
                    <td className="py-3 px-3 flex items-center gap-2">
                      {t.name}
                      {expandedTeamId === t.id ? <span className="text-pfa-green">▲</span> : <span className="text-white/40">▼</span>}
                    </td>
                    <td className="py-3 px-3">{t.sport}</td>
                    <td className="py-3 px-3">{t.age_category || '-'}</td>
                    <td className="py-3 px-3">{t.competition_level || '-'}</td>
                    <td className="py-3 px-3">
                      <span
                        className="inline-block w-6 h-6 rounded-full border border-pfa-border"
                        style={{ backgroundColor: t.primary_color || '#3fae52' }}
                      />
                    </td>
                    <td className="py-3 px-3">{t.coach_id || '-'}</td>
                    <td className="py-3 px-3 space-x-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          openEditTeam(t)
                        }}
                        className="text-pfa-green hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteTeam(t.id)
                        }}
                        className="text-red-400 hover:underline"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                  {expandedTeamId === t.id && (
                    <tr className="bg-white/5">
                      <td colSpan={7} className="py-3 px-3">
                        <div className="space-y-2">
                          <div className="text-white font-semibold">Roster</div>
                          <div className="overflow-x-auto bg-[#0a0f0a] border border-pfa-border rounded-lg">
                            <table className="min-w-full text-sm">
                              <thead className="text-white/60">
                                <tr className="border-b border-pfa-border">
                                  <th className="py-2 px-3 text-left">Name</th>
                                  <th className="py-2 px-3 text-left">Sport</th>
                                  <th className="py-2 px-3 text-left">Position</th>
                                  <th className="py-2 px-3 text-left">Age Category</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-pfa-border">
                                {(teamRosterMap[t.id] || []).length === 0 ? (
                                  <tr>
                                    <td className="py-2 px-3 text-white/60" colSpan={4}>
                                      No athletes assigned.
                                    </td>
                                  </tr>
                                ) : (
                                  (teamRosterMap[t.id] || []).map((r) => (
                                    <tr key={`${t.id}-${r.athlete_id}`}>
                                      <td className="py-2 px-3">{r.profiles?.full_name || '-'}</td>
                                      <td className="py-2 px-3">{r.profiles?.sport || '-'}</td>
                                      <td className="py-2 px-3">{r.profiles?.position || '-'}</td>
                                      <td className="py-2 px-3">{r.profiles?.age_category || '-'}</td>
                                    </tr>
                                  ))
                                )}
                              </tbody>
                            </table>
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

      {teamModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 overflow-x-hidden">
          <div
            className="bg-[#0d1a0e] border border-pfa-border rounded-xl p-6 w-full max-h-[90vh] overflow-y-auto overflow-x-hidden"
            style={{ maxWidth: '672px', boxSizing: 'border-box' }}
          >
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
                className="bg-[#0a0f0a] border border-pfa-border rounded-lg px-3 py-2 text-white w-full"
              />
              <select
                value={teamForm.sport}
                onChange={(e) => setTeamForm({ ...teamForm, sport: e.target.value, age_category: '' })}
                className="bg-[#0a0f0a] border border-pfa-border rounded-lg px-3 py-2 text-white w-full"
              >
                {SPORT_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <select
                value={teamForm.age_category}
                onChange={(e) => setTeamForm({ ...teamForm, age_category: e.target.value })}
                className="bg-[#0a0f0a] border border-pfa-border rounded-lg px-3 py-2 text-white w-full"
              >
                <option value="">Age Category</option>
                {getAgeCategories(teamForm.sport).map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              <select
                value={teamForm.competition_level}
                onChange={(e) => setTeamForm({ ...teamForm, competition_level: e.target.value })}
                className="bg-[#0a0f0a] border border-pfa-border rounded-lg px-3 py-2 text-white w-full"
              >
                {['Pro', 'Semi-Pro', 'University', 'Junior', 'AAA', 'AA', 'A', 'Recreational'].map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {lvl}
                  </option>
                ))}
              </select>
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
              <div className="md:col-span-2">
                <label className="text-white/70 text-sm block mb-1">Team Coach</label>
                <select
                  value={teamForm.coach_id}
                  onChange={(e) => setTeamForm({ ...teamForm, coach_id: e.target.value })}
                  className="bg-[#0a0f0a] border border-pfa-border rounded-lg px-3 py-2 text-white w-full"
                >
                  <option value="">Select coach</option>
                  {teamCoachOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2 border-t border-pfa-border pt-4 mt-2 space-y-3">
                <div className="text-white font-semibold">Roster</div>
                <div className="bg-[#0a0f0a] border border-pfa-border rounded-lg overflow-hidden" style={{ overflowX: 'hidden' }}>
                  <table className="min-w-full text-sm" style={{ tableLayout: 'fixed', width: '100%' }}>
                    <thead className="text-white/60">
                      <tr className="border-b border-pfa-border">
                        <th className="py-2 px-3 text-left">Name</th>
                        <th className="py-2 px-3 text-left">Sport</th>
                        <th className="py-2 px-3 text-left">Position</th>
                        <th className="py-2 px-3 text-left">Age Category</th>
                        <th className="py-2 px-3 text-left">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-pfa-border">
                      {(teamRosterMap[editingTeam?.id] || []).length === 0 ? (
                        <tr>
                          <td className="py-2 px-3 text-white/60" colSpan={5}>
                            No athletes on this team yet.
                          </td>
                        </tr>
                      ) : (
                        (teamRosterMap[editingTeam?.id] || []).map((r) => (
                          <tr key={r.athlete_id}>
                            <td className="py-2 px-3">{r.profiles?.full_name || '-'}</td>
                            <td className="py-2 px-3">{r.profiles?.sport || '-'}</td>
                            <td className="py-2 px-3">{r.profiles?.position || '-'}</td>
                            <td className="py-2 px-3">{r.profiles?.age_category || '-'}</td>
                            <td className="py-2 px-3">
                              <button
                                type="button"
                                className="text-red-400 hover:underline"
                                onClick={async () => {
                                  await removeAthleteFromTeam(editingTeam?.id, r.athlete_id)
                                }}
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  <input
                    value={teamAddAthleteSearch}
                    onChange={(e) => setTeamAddAthleteSearch(e.target.value)}
                    placeholder="Search athlete"
                    className="bg-[#0a0f0a] border border-pfa-border rounded-lg px-3 py-2 text-white"
                  />
                  <div className="bg-[#0a0f0a] border border-pfa-border rounded-lg p-2 max-h-[200px] overflow-y-auto">
                    {availableTeamAthletes.length === 0 ? (
                      <div className="text-white/60 text-sm">No available athletes.</div>
                    ) : (
                      availableTeamAthletes.map((a) => {
                        const checked = selectedTeamAthletes.includes(a.id)
                        return (
                          <label key={a.id} className="flex items-center gap-2 py-1 text-sm text-white/80">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedTeamAthletes((prev) => [...prev, a.id])
                                } else {
                                  setSelectedTeamAthletes((prev) => prev.filter((id) => id !== a.id))
                                }
                              }}
                            />
                            <span>
                              {a.full_name}
                              {a.sport ? ` • ${a.sport}` : ''}
                            </span>
                          </label>
                        )
                      })
                    )}
                  </div>
                  <button
                    type="button"
                    className={`bg-pfa-green text-black font-semibold px-3 py-2 rounded-lg ${selectedTeamAthletes.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                    disabled={selectedTeamAthletes.length === 0}
                    onClick={async () => {
                      if (!editingTeam?.id || selectedTeamAthletes.length === 0) return
                      try {
                        const inserts = selectedTeamAthletes.map((athlete_id) => ({ team_id: editingTeam.id, athlete_id }))
                        await supabase.from('athlete_teams').insert(inserts)
                        setSelectedTeamAthletes([])
                        await loadTeamRoster(editingTeam.id)
                      } catch (err) {
                        console.error('Batch add athletes failed', err)
                      }
                    }}
                  >
                    Add Selected ({selectedTeamAthletes.length})
                  </button>
                </div>

                <button
                  type="button"
                  className={`w-full border border-pfa-border text-white rounded-lg px-4 py-2 hover:border-pfa-green ${
                    editingTeam?.id ? '' : 'opacity-50 cursor-not-allowed'
                  }`}
                  onClick={() => {
                    setPendingTeamForNewAthlete(editingTeam)
                    setForceAthleteRole(true)
                    setUserForm({
                      full_name: '',
                      email: '',
                      password: '',
                      role: 'athlete',
                      sport: '',
                      age_category: '',
                      position: '',
                      gender: 'male',
                      competition_level: '',
                      team_id: '',
                      linked_athlete_id: '',
                    })
                    setTeamModalOpen(false)
                    setUserModalOpen(true)
                  }}
                >
                  Create & Add New Athlete
                </button>
              </div>

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
            {SPORT_OPTIONS.map((s) => (
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
                      if (nextId) {
                        loadAthleteTeams(a.id)
                        loadAthleteResults(a.id)
                      }
                    }}
                  >
                    <td className="py-3 px-3">{a.full_name}</td>
                    <td className="py-3 px-3">{a.sport}</td>
                    <td className="py-3 px-3">{a.position || '-'}</td>
                    <td className="py-3 px-3">{a.pfa_teams?.name || '-'}</td>
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
                          <div className="mt-6 space-y-2">
                            <div className="text-white font-semibold">Test Results</div>
                            {(() => {
                              const results = athleteResultsMap[a.id]
                              const grouped = Array.isArray(results) ? groupResultsByCategory(results) : {}
                              return Object.keys(grouped).length === 0 ? (
                                <div className="text-white/60 text-sm">No test results yet.</div>
                              ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                  {Object.entries(grouped)
                                    .sort(([aCat], [bCat]) => aCat.localeCompare(bCat))
                                    .map(([cat, rows]) => (
                                      <div key={cat} className="bg-[#0a0f0a] border border-pfa-border rounded-lg p-3 space-y-2">
                                        <div className="text-xs text-pfa-green font-semibold tracking-[0.1em]">{cat}</div>
                                        {rows.slice(0, 6).map((r) => (
                                          <div key={r.id} className="flex items-center justify-between text-sm text-white/80">
                                            <span className="capitalize">{r.test_type.replaceAll('_', ' ')}</span>
                                            <span className="font-semibold text-white">{`${r.value}${r.unit || ''}`}</span>
                                          </div>
                                        ))}
                                        {rows.length > 6 && (
                                          <div className="text-xs text-white/50">+{rows.length - 6} more</div>
                                        )}
                                      </div>
                                    ))}
                                </div>
                              )
                            })()}
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
            <a
              href="/session"
              className={`${navItemBase} block border border-transparent text-white/60 hover:text-pfa-green hover:border-pfa-green`}
            >
              Sessions
            </a>
            <a
              href="/report"
              className={`${navItemBase} block border border-transparent text-white/60 hover:text-pfa-green hover:border-pfa-green`}
            >
              Progress Reports
            </a>
            <a
              href="/checkin"
              className={`${navItemBase} block border border-transparent text-white/60 hover:text-pfa-green hover:border-pfa-green`}
            >
              Check-in
            </a>
          </div>
        </aside>

        <main className="space-y-6">
          <div className="bg-[#0d1a0e] border border-pfa-border rounded-xl p-4 flex items-center justify-between">
            <div className="text-lg font-semibold text-white">{activeSection}</div>
            <div className="text-sm text-white/60">{profile?.full_name || 'Rick Leger'} — {formatRole(profile?.role)}</div>
          </div>
          {renderSection()}
        </main>
      </div>
    </DashboardLayout>
  )
}

export default Admin
