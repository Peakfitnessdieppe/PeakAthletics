import React, { useEffect, useMemo, useState } from 'react'
import DashboardLayout from '../components/layout/DashboardLayout'
import useAuth from '../hooks/useAuth'
import { supabase } from '../services/supabase'
import {
  getAllAthletes,
  getAthleteTeams,
  addAthleteToTeam,
  removeAthleteFromTeam,
  saveBodyMeasurement,
  getAthleteRecentMeasurements,
} from '../services/athletes'
import { getAllTeams, createTeam, updateTeam, getTeamRoster } from '../services/teams'
import { createUser as createAdminUser, deleteUser as deleteAdminUser, updateUser as updateAdminUser } from '../services/adminUsers'
import { formatRole } from '../utils/formatRole'

const sectionList = ['Dashboard', 'Users', 'PFA Staff', 'Teams', 'Coaches', 'Athletes', 'Settings']

const navItemBase =
  'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium cursor-pointer transition-colors'

const SECTION_LABELS = {
  users: 'Users',
  staff: 'PFA Staff',
  'PFA Staff': 'PFA Staff',
  teams: 'Teams',
  coaches: 'Coaches',
  athletes: 'Athletes',
  settings: 'Settings',
  scoreWeights: 'Score Weights',
  measurements: 'Measurements',
  dashboard: 'Dashboard',
  programs: 'Programs',
}

const SPORTS = [
  'Hockey',
  'Soccer',
  'American Football',
  'Ringette',
  'Volleyball',
  'Basketball',
  'Baseball',
  'Lacrosse',
  'Tennis',
  'Track & Field',
  'Martial Arts',
  'Other'
]
const AGE_CATEGORIES = ['U13', 'U14', 'U15', 'U16', 'U17', 'U18', 'U19', 'Junior', 'Senior']
const GENDERS = ['male', 'female']
const CATEGORY_LABELS = { speed: 'Speed', strength: 'Strength', power: 'Power', agility: 'Agility', endurance: 'Endurance' }
const TEST_LABELS = {
  squat: 'Squat', bench_press: 'Bench Press', trap_bar_deadlift: 'Trap Bar Deadlift',
  pull_ups: 'Pull Ups', push_ups: 'Push Ups', vertical_jump: 'Vertical Jump',
  broad_jump: 'Broad Jump', mb_chest_pass: 'MB Chest Pass', '10m_sprint': '10m Sprint',
  '30m_sprint': '30m Sprint', pro_agility_shuttle: 'Pro Agility Shuttle',
  beep_test: 'Beep Test', triple_jump: 'Triple Jump', plank: 'Plank',
}
const AVAILABLE_TESTS = {
  strength: ['squat', 'bench_press', 'trap_bar_deadlift', 'pull_ups', 'push_ups'],
  power: ['vertical_jump', 'broad_jump', 'mb_chest_pass'],
}
const CATEGORIES = ['speed', 'strength', 'power', 'agility', 'endurance']
const UNITS = ['lbs', 'kg', 'reps', 'sec', 'cm', 'm', 'level']

const CARD_MODAL_LOWER_IS_BETTER = ['10m_sprint', '30m_sprint', 'pro_agility_shuttle']
const CARD_MODAL_TEST_LABELS = {
  '10m_sprint': '10m Sprint',
  '30m_sprint': '30m Sprint',
  vertical_jump: 'Vertical Jump',
  broad_jump: 'Broad Jump',
  ncmj: 'NCMJ',
  mb_chest_pass: 'MB Chest Pass',
  pro_agility_shuttle: 'Pro Agility',
  beep_test: 'Beep Test',
  squat: 'Squat*',
  trap_bar_deadlift: 'Trap Bar Deadlift*',
  bench_press: 'Bench Press*',
  pull_ups: 'Pull-Ups',
  push_ups: 'Push-Ups',
  imtp: 'IMTP',
  triple_jump: 'Triple Jump',
  plank: 'Plank',
}
const CARD_MODAL_TEST_UNITS = {
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
  triple_jump: 'm',
  plank: 's',
}
const CARD_MODAL_ALL_TESTS = [
  '10m_sprint',
  '30m_sprint',
  'vertical_jump',
  'broad_jump',
  'triple_jump',
  'mb_chest_pass',
  'pro_agility_shuttle',
  'beep_test',
  'squat',
  'trap_bar_deadlift',
  'bench_press',
  'pull_ups',
  'push_ups',
  'plank',
  'imtp',
]
const CARD_MODAL_ROUND_TO_INT = ['squat', 'trap_bar_deadlift', 'bench_press', 'imtp', 'push_ups', 'pull_ups']

const getCardModalSeasonYear = (dateStr) => {
  const d = new Date(dateStr)
  return d.getMonth() >= 8 ? d.getFullYear() + 1 : d.getFullYear()
}

const buildCardModalSeasonStats = (results) => {
  const byTestBySeason = {}
  for (const r of results || []) {
    const season = getCardModalSeasonYear(r.date_tested)
    if (!byTestBySeason[r.test_type]) byTestBySeason[r.test_type] = {}
    const current = byTestBySeason[r.test_type][season]
    const isBetter = CARD_MODAL_LOWER_IS_BETTER.includes(r.test_type)
      ? r.value < (current ?? Infinity)
      : r.value > (current ?? -Infinity)
    if (!current || isBetter) byTestBySeason[r.test_type][season] = r.value
  }
  const formatVal = (testType, val) => {
    if (val === undefined || val === null) return '—'
    const v = CARD_MODAL_ROUND_TO_INT.includes(testType) ? Math.round(val) : val
    return `${v} ${CARD_MODAL_TEST_UNITS[testType] || ''}`.trim()
  }
  return CARD_MODAL_ALL_TESTS.map((testType) => ({
    testType,
    label: CARD_MODAL_TEST_LABELS[testType] || testType,
    season2025: formatVal(testType, byTestBySeason[testType]?.[2025]),
    season2026: formatVal(testType, byTestBySeason[testType]?.[2026]),
    hasAnyData: !!(byTestBySeason[testType]?.[2025] || byTestBySeason[testType]?.[2026]),
  }))
}

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
  const [coachMap, setCoachMap] = useState({})
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

  const [coaches, setCoaches] = useState([])
  const [coachesLoading, setCoachesLoading] = useState(false)
  const [expandedCoaches, setExpandedCoaches] = useState({})
  const [coachAddSelected, setCoachAddSelected] = useState([])
  const [coachAddSearch, setCoachAddSearch] = useState('')

  const [staffList, setStaffList] = useState([])

  const [cardModalAthlete, setCardModalAthlete] = useState(null)
  const [cardModalResults, setCardModalResults] = useState([])
  const [cardModalMeasurements, setCardModalMeasurements] = useState([])
  const [cardModalScores, setCardModalScores] = useState(null)

  const [athletes, setAthletes] = useState([])
  const [athletesLoading, setAthletesLoading] = useState(false)
  const [athleteSearch, setAthleteSearch] = useState('')
  const [athleteSportFilter, setAthleteSportFilter] = useState('All')
  const [athleteTeamFilter, setAthleteTeamFilter] = useState('All')
  const [expandedAthleteId, setExpandedAthleteId] = useState(null)
  const [athleteTeamsMap, setAthleteTeamsMap] = useState({})
  const [athleteTeamSelect, setAthleteTeamSelect] = useState({})
  const [athleteResultsMap, setAthleteResultsMap] = useState({})
  const [athleteBodyMap, setAthleteBodyMap] = useState({})
  const [editingAthleteId, setEditingAthleteId] = useState(null)
  const [editingAthleteData, setEditingAthleteData] = useState({})
  const [editingResultId, setEditingResultId] = useState(null)
  const [editingResultData, setEditingResultData] = useState({})
  const [editingBodyId, setEditingBodyId] = useState(null)
  const [editingBodyData, setEditingBodyData] = useState({})
  const [athleteSaveStatus, setAthleteSaveStatus] = useState('')
  const [showAllResults, setShowAllResults] = useState({})

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

  const [passwordChange, setPasswordChange] = useState('')
  const [passwordMessage, setPasswordMessage] = useState('')

  const [recalcStatus, setRecalcStatus] = useState('')
  const [defaultCatWeights, setDefaultCatWeights] = useState({ speed: 25, strength: 25, power: 25, agility: 15, endurance: 10 })
  const [defaultTestWeights, setDefaultTestWeights] = useState({})
  const [activeTestWeights, setActiveTestWeights] = useState({})
  const [customWeightSets, setCustomWeightSets] = useState([])
  const [newCustom, setNewCustom] = useState({ sport: '', age_category: '', gender: '', speed: 25, strength: 25, power: 25, agility: 15, endurance: 10 })
  const [newCustomTestWeights, setNewCustomTestWeights] = useState({})
  const [weightsLoading, setWeightsLoading] = useState(false)
  const [weightsSaved, setWeightsSaved] = useState('')
  const [tests, setTests] = useState([])
  const [testsLoading, setTestsLoading] = useState(false)
  const [editingTest, setEditingTest] = useState(null)
  const [newTest, setNewTest] = useState({ test_type: '', display_name: '', category: 'strength', unit: 'lbs', lower_is_better: false, is_load_based: false, is_active: true })
  const [testsSaved, setTestsSaved] = useState('')
  const [editingWeightSet, setEditingWeightSet] = useState(null)
  const [editingWeightSetTests, setEditingWeightSetTests] = useState({})
  const [expandedWeightSet, setExpandedWeightSet] = useState(null)
  const [weightableTests, setWeightableTests] = useState({})

  const [programs, setPrograms] = useState([])
  const [programsLoading, setProgramsLoading] = useState(false)
  const [selectedProgram, setSelectedProgram] = useState(null)
  const [selectedWeek, setSelectedWeek] = useState(null)
  const [selectedDay, setSelectedDay] = useState(null)
  const [weeks, setWeeks] = useState([])
  const [days, setDays] = useState([])
  const [exercises, setExercises] = useState([])
  const [showProgramForm, setShowProgramForm] = useState(false)
  const [programForm, setProgramForm] = useState({
    title: '', slug: '', description: '', sport: 'all',
    tags: '', weeks_total: 8, days_per_week: 4,
    minutes_per_session: 60, level: 'all',
    pdf_url: '', thumbnail_url: '', published: false
  })
  const [weekForm, setWeekForm] = useState({ week_number: '', focus: '' })
  const [dayForm, setDayForm] = useState({ day_number: '', label: '', session_type: 'Training' })
  const [exerciseForm, setExerciseForm] = useState({
    name: '', sets_reps: '', coaching_notes: '',
    video_url: '', video_provider: 'youtube', sort_order: 0
  })

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

  const loadCoaches = async () => {
    setCoachesLoading(true)
    try {
      const { data: coachProfiles, error: coachError } = await supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .eq('role', 'team_coach')
        .order('full_name')
      if (coachError) throw coachError

      const { data: allTeams, error: teamsError } = await supabase
        .from('pfa_teams')
        .select('id, name, sport, coach_id')
      if (teamsError) throw teamsError
      setTeams(allTeams || [])

      const coachesWithTeams = (coachProfiles || []).map((c) => ({
        ...c,
        team: (allTeams || []).find((t) => t.coach_id === c.id) || null,
      }))
      setCoaches(coachesWithTeams)
    } catch (err) {
      console.error('Load coaches failed', err)
    }
    setCoachesLoading(false)
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

  const loadAthleteBodyMeasurements = async (athleteId) => {
    try {
      const { data, error } = await supabase
        .from('pfa_body_measurements')
        .select('id, measurement_date, weight, body_fat_percentage, muscle_mass, height')
        .eq('athlete_id', athleteId)
        .order('measurement_date', { ascending: false })
        .limit(5)
      console.log('[PFA DEBUG] body measurements fetch', { athleteId, data, error })
      if (!error) {
        setAthleteBodyMap((prev) => ({ ...prev, [athleteId]: data || [] }))
      }
    } catch (err) {
      console.error('Athlete body measurements load error', err)
    }
  }

  const handleSaveAthlete = async (athleteId) => {
    const d = editingAthleteData
    const { error } = await supabase.from('profiles').update({
      full_name: d.full_name,
      email: d.email,
      phone: d.phone,
      sport: d.sport,
      position: d.position,
      gender: d.gender,
      age_category: d.age_category,
      competition_level: d.competition_level,
      date_of_birth: d.date_of_birth,
      parent_name: d.parent_name,
      parent_email: d.parent_email,
      parent_phone: d.parent_phone,
      updated_at: new Date().toISOString()
    }).eq('id', athleteId)
    if (!error) {
      setAthletes((prev) => prev.map((a) => a.id === athleteId ? { ...a, ...d } : a))
      setEditingAthleteId(null)
      setAthleteSaveStatus('saved')
      setTimeout(() => setAthleteSaveStatus(''), 3000)
    }
  }

  const handleSaveResult = async () => {
    const { error } = await supabase.from('pfa_test_results').update({
      value: parseFloat(editingResultData.value),
      load_value: editingResultData.load_value ? parseFloat(editingResultData.load_value) : null,
      reps: editingResultData.reps ? parseInt(editingResultData.reps) : null,
      date_tested: editingResultData.date_tested,
      unit: editingResultData.unit,
      updated_at: new Date().toISOString()
    }).eq('id', editingResultId)
    if (!error) {
      setAthleteResultsMap((prev) => ({
        ...prev,
        [editingResultData.athlete_id]: (prev[editingResultData.athlete_id] || []).map((r) =>
          r.id === editingResultId ? { ...r, ...editingResultData } : r
        )
      }))
      setEditingResultId(null)
      setEditingResultData({})
    }
  }

  const saveBodyMeasurement = async () => {
    const { error } = await supabase
      .from('pfa_body_measurements')
      .update({
        measurement_date: editingBodyData.measurement_date,
        weight: editingBodyData.weight ? parseFloat(editingBodyData.weight) : null,
        body_fat_percentage: editingBodyData.body_fat_percentage ? parseFloat(editingBodyData.body_fat_percentage) : null,
        muscle_mass: editingBodyData.muscle_mass ? parseFloat(editingBodyData.muscle_mass) : null,
        height: editingBodyData.height ? parseFloat(editingBodyData.height) : null
      })
      .eq('id', editingBodyId)
    if (!error) {
      setEditingBodyId(null)
      setEditingBodyData({})
      loadAthleteBodyMeasurements(editingBodyData.athlete_id)
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

  const renderStaff = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-white">PFA Staff</h3>
          <span className="text-xs px-2 py-1 rounded-full bg-white/10 text-white/70">{staffList.length}</span>
        </div>
      </div>

      <div className="overflow-x-auto bg-[#0d1a0e] border border-pfa-border rounded-xl">
        <table className="min-w-full text-sm">
          <thead className="text-white/60">
            <tr className="border-b border-pfa-border">
              <th className="py-3 px-3 text-left">Name</th>
              <th className="py-3 px-3 text-left">Email</th>
              <th className="py-3 px-3 text-left">Role</th>
              <th className="py-3 px-3 text-left">Created</th>
              <th className="py-3 px-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-pfa-border">
            {staffList.length === 0 ? (
              <tr>
                <td className="py-3 px-3 text-white/60" colSpan={5}>
                  No staff found.
                </td>
              </tr>
            ) : (
              staffList.map((staff) => {
                const createdAt = staff.created_at
                  ? new Date(staff.created_at).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })
                  : '—'
                const roleStyle =
                  staff.role === 'pfa_admin'
                    ? { background: 'rgba(255,215,0,0.15)', color: '#FFD700', padding: '4px 10px', borderRadius: '999px', fontWeight: 700 }
                    : { background: 'rgba(63,174,82,0.15)', color: '#3fae52', padding: '4px 10px', borderRadius: '999px', fontWeight: 700 }

                return (
                  <tr key={staff.id} className="hover:bg-white/5">
                    <td className="py-3 px-3 text-white font-semibold">{staff.full_name || 'Unnamed'}</td>
                    <td className="py-3 px-3 text-white/60">{staff.email || '—'}</td>
                    <td className="py-3 px-3">
                      <span style={roleStyle}>{staff.role === 'pfa_admin' ? 'Admin' : 'Staff'}</span>
                    </td>
                    <td className="py-3 px-3 text-white/50">{createdAt}</td>
                    <td className="py-3 px-3 space-x-2">
                      <button
                        onClick={() => openEditUser(staff)}
                        className="text-pfa-green hover:underline"
                      >
                        Edit
                      </button>
                      {staff.role !== 'pfa_admin' && (
                        <button
                          onClick={() => handleRemoveStaff(staff)}
                          className="text-red-400 hover:underline"
                        >
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )

  const renderCoaches = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-white">Coaches</h3>
          <span className="text-xs px-2 py-1 rounded-full bg-white/10 text-white/70">{coaches.length}</span>
        </div>
      </div>

      <div className="overflow-x-auto bg-[#0d1a0e] border border-pfa-border rounded-xl">
        <table className="min-w-full text-sm">
          <thead className="text-white/60">
            <tr className="border-b border-pfa-border">
              <th className="py-3 px-3 text-left">Name</th>
              <th className="py-3 px-3 text-left">Email</th>
              <th className="py-3 px-3 text-left">Assigned Team</th>
              <th className="py-3 px-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-pfa-border">
            {coachesLoading ? (
              <tr>
                <td className="py-3 px-3 text-white/60" colSpan={4}>
                  Loading coaches...
                </td>
              </tr>
            ) : coaches.length === 0 ? (
              <tr>
                <td className="py-3 px-3 text-white/60" colSpan={4}>
                  No coaches found.
                </td>
              </tr>
            ) : (
              coaches.map((coach) => {
                const expanded = !!expandedCoaches[coach.id]
                return (
                  <React.Fragment key={coach.id}>
                    <tr
                      className="hover:bg-white/5 cursor-pointer"
                      onClick={() => {
                        setExpandedCoaches((prev) => ({ ...prev, [coach.id]: !expanded }))
                        if (!expanded && coach.team?.id) {
                          loadTeamRoster(coach.team.id)
                          setCoachAddSelected([])
                          setCoachAddSearch('')
                        }
                      }}
                    >
                      <td className="py-3 px-3 text-white">{coach.full_name}</td>
                      <td className="py-3 px-3">{coach.email}</td>
                      <td className="py-3 px-3">{coach.team?.name || '—'}</td>
                      <td className="py-3 px-3 space-y-2">
                        <select
                          value={coach.team?.id || ''}
                          onChange={(e) => handleReassignCoach(coach, e.target.value)}
                          className="bg-[#0a0f0a] border border-pfa-border rounded-lg px-3 py-2 text-white w-full"
                        >
                          <option value="">Select team</option>
                          {teams.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                        {coach.team?.id && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleRemoveCoachTeam(coach)
                            }}
                            className="text-xs px-3 py-2 rounded-md bg-white/10 text-white/80 hover:bg-white/20"
                          >
                            Remove from Team
                          </button>
                        )}
                      </td>
                    </tr>
                    {expanded && (
                      <tr className="bg-[#0a0f0a]">
                        <td colSpan={4} className="py-3 px-3">
                          {coach.team?.id ? (
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <div className="text-white/80 text-sm">Roster — {coach.team.name}</div>
                                <div className="text-white/60 text-xs">
                                  {teamRosterMap[coach.team.id]?.length || 0} athletes
                                </div>
                              </div>

                              <div className="bg-[#0d1a0e] border border-pfa-border rounded-lg overflow-hidden">
                                <table className="min-w-full text-xs">
                                  <thead className="text-white/60">
                                    <tr className="border-b border-pfa-border">
                                      <th className="py-2 px-3 text-left">Name</th>
                                      <th className="py-2 px-3 text-left">Sport</th>
                                      <th className="py-2 px-3 text-left">Position</th>
                                      <th className="py-2 px-3 text-left">Age Category</th>
                                      <th className="py-2 px-3 text-left">Action</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-pfa-border">
                                    {(teamRosterMap[coach.team.id] || []).map((ath) => (
                                      <tr key={ath.athlete_id}>
                                        <td className="py-2 px-3 text-white">{ath.profiles?.full_name}</td>
                                        <td className="py-2 px-3">{ath.profiles?.sport || '—'}</td>
                                        <td className="py-2 px-3">{ath.profiles?.position || '—'}</td>
                                        <td className="py-2 px-3">{ath.profiles?.age_category || '—'}</td>
                                        <td className="py-2 px-3">
                                          <button
                                            className="text-xs px-3 py-1 rounded-md bg-red-500/20 text-red-300 hover:bg-red-500/30"
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              removeAthleteFromTeam(coach.team.id, ath.athlete_id)
                                            }}
                                          >
                                            Remove
                                          </button>
                                        </td>
                                      </tr>
                                    ))}
                                    {(teamRosterMap[coach.team.id] || []).length === 0 && (
                                      <tr>
                                        <td className="py-2 px-3 text-white/60" colSpan={5}>
                                          No athletes assigned yet.
                                        </td>
                                      </tr>
                                    )}
                                  </tbody>
                                </table>
                              </div>

                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <input
                                    value={coachAddSearch}
                                    onChange={(e) => setCoachAddSearch(e.target.value)}
                                    placeholder="Search athletes"
                                    className="bg-[#0d1a0e] border border-pfa-border rounded-lg px-3 py-2 text-sm text-white"
                                  />
                                  <button
                                    className="px-3 py-2 rounded-md bg-pfa-green text-black text-sm font-semibold"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      addAthletesToCoachTeam(coach.team.id)
                                    }}
                                    disabled={coachAddSelected.length === 0}
                                  >
                                    Add Selected ({coachAddSelected.length})
                                  </button>
                                </div>
                                <div className="max-h-48 overflow-y-auto space-y-1 border border-pfa-border rounded-lg p-2 bg-[#0d1a0e]">
                                  {teamAthleteOptions
                                    .filter((a) => !teamRosterMap[coach.team.id]?.some((ra) => ra.athlete_id === a.id))
                                    .filter((a) => a.full_name.toLowerCase().includes(coachAddSearch.toLowerCase()))
                                    .map((a) => {
                                      const checked = coachAddSelected.includes(a.id)
                                      return (
                                        <label key={a.id} className="flex items-center gap-2 text-white/80 text-sm">
                                          <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={(e) => {
                                              if (e.target.checked) {
                                                setCoachAddSelected((prev) => [...prev, a.id])
                                              } else {
                                                setCoachAddSelected((prev) => prev.filter((id) => id !== a.id))
                                              }
                                            }}
                                          />
                                          <span>{a.full_name} — {a.sport} {a.position ? `· ${a.position}` : ''}</span>
                                        </label>
                                      )
                                    })}
                                  {teamAthleteOptions.filter((a) => !teamRosterMap[coach.team.id]?.some((ra) => ra.athlete_id === a.id)).length === 0 && (
                                    <div className="text-white/50 text-sm">No available athletes.</div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="text-white/60 text-sm">No team assigned — reassign a team first.</div>
                          )}
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

  const filteredAthletes = useMemo(() => {
    const term = athleteSearch.toLowerCase()
    return athletes
      .filter((a) =>
        athleteSportFilter === 'All' ? true : a.sport === athleteSportFilter
      )
      .filter((a) => (athleteTeamFilter === 'All' ? true : a.team_id === athleteTeamFilter))
      .filter((a) => a.full_name?.toLowerCase().includes(term))
  }, [athletes, athleteSearch, athleteSportFilter, athleteTeamFilter])

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
    if (!error) {
      setUsers(data || [])

      // preload teams for users (athletes) to show in table
      const teamsByUser = {}
      await Promise.all((data || []).map(async (u) => {
        if (u.role !== 'athlete') return
        try {
          const teams = await getAthleteTeams(u.id)
          teamsByUser[u.id] = teams || []
        } catch (err) {
          console.error('User teams preload error', err)
        }
      }))
      setAthleteTeamsMap((prev) => ({ ...prev, ...teamsByUser }))
    }
    setUsersLoading(false)
  }

  const loadStaff = async () => {
    try {
      const { data: staffData, error } = await supabase
        .from('profiles')
        .select('*')
        .in('role', ['pfa_staff', 'pfa_admin'])
        .order('full_name')
      if (error) throw error
      setStaffList(staffData || [])
    } catch (err) {
      console.error('Load staff failed', err)
    }
  }

  const loadTeams = async () => {
    setTeamsLoading(true)
    try {
      const { data: teamsData, error: teamsError } = await supabase
        .from('pfa_teams')
        .select('*')
        .order('name')
      if (teamsError) throw teamsError

      const { data: coachProfiles, error: coachError } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('role', 'team_coach')
      if (coachError) throw coachError

      const lookup = {}
      ;(coachProfiles || []).forEach((c) => {
        lookup[c.id] = c.full_name
      })
      setCoachMap(lookup)

      const teamsWithCoach = (teamsData || []).map((t) => ({
        ...t,
        coachName: t.coach_id ? lookup[t.coach_id] || t.coach_id : '—',
      }))
      setTeams(teamsWithCoach)
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

      // preload team memberships for table display
      const teamsByAthlete = {}
      await Promise.all((data || []).map(async (ath) => {
        try {
          const teams = await getAthleteTeams(ath.id)
          teamsByAthlete[ath.id] = teams || []
        } catch (err) {
          console.error('Athlete teams preload error', err)
        }
      }))
      setAthleteTeamsMap(teamsByAthlete)
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

  const getSeasonYear = (dateStr) => {
    const d = new Date(dateStr)
    return d.getMonth() >= 8 ? d.getFullYear() + 1 : d.getFullYear()
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
  }, [])

  useEffect(() => {
    if (activeSection === 'Coaches') {
      loadCoaches()
      loadAllAthletesForTeams()
    }
  }, [activeSection])

  useEffect(() => {
    if (activeSection === 'PFA Staff' || activeSection === 'staff') {
      loadStaff()
    }
  }, [activeSection])

  useEffect(() => {
    if (activeSection !== 'scoreWeights') return
    const loadWeights = async () => {
      setWeightsLoading(true)
      try {
        const { data: allCatW } = await supabase.from('pfa_score_weights').select('*').order('created_at', { ascending: true })
        const defaultRow = allCatW?.find((r) => r.is_default)
        if (defaultRow) {
          setDefaultCatWeights({
            speed: Math.round((defaultRow.speed_weight || 0.25) * 100),
            strength: Math.round((defaultRow.strength_weight || 0.25) * 100),
            power: Math.round((defaultRow.power_weight || 0.25) * 100),
            agility: Math.round((defaultRow.agility_weight || 0.15) * 100),
            endurance: Math.round((defaultRow.endurance_weight || 0.1) * 100),
          })
        }
        setCustomWeightSets(allCatW?.filter((r) => !r.is_default) || [])

        const { data: testW } = await supabase
          .from('pfa_test_weights')
          .select('*')
          .eq('sport', 'default')
          .eq('age_category', 'default')
          .eq('is_active', true)
        if (testW) {
          const grouped = {}
          for (const row of testW) {
            if (!grouped[row.category]) grouped[row.category] = {}
            grouped[row.category][row.test_type] = { weight: Math.round(row.weight * 100), is_active: row.is_active, id: row.id }
          }
          setDefaultTestWeights(grouped)
        }

        const { data: allActiveTestWeights } = await supabase
          .from('pfa_test_weights')
          .select('*')
          .eq('is_active', true)

        if (allActiveTestWeights) {
          const groupedBySet = {}
          for (const row of allActiveTestWeights) {
            const key = `${row.sport}|${row.age_category}|${row.gender || 'all'}`
            if (!groupedBySet[key]) groupedBySet[key] = {}
            if (!groupedBySet[key][row.category]) groupedBySet[key][row.category] = {}
            groupedBySet[key][row.category][row.test_type] = { weight: Math.round(row.weight * 100), id: row.id }
          }
          setActiveTestWeights(groupedBySet)
        }

        const { data: allTests } = await supabase
          .from('pfa_tests')
          .select('test_type, category, display_name')
          .eq('is_active', true)
          .order('display_name')

        if (allTests) {
          const groupedTests = {}
          for (const t of allTests) {
            if (!groupedTests[t.category]) groupedTests[t.category] = []
            groupedTests[t.category].push({ test_type: t.test_type, display_name: t.display_name })
          }
          setWeightableTests(groupedTests)
        }
      } catch (err) {
        console.error('Error loading weights:', err)
      } finally {
        setWeightsLoading(false)
      }
    }

    loadWeights()
  }, [activeSection])

  useEffect(() => {
    if (activeSection !== 'tests') return
    const loadTests = async () => {
      setTestsLoading(true)
      const { data } = await supabase.from('pfa_tests').select('*').order('category').order('display_name')
      setTests(data || [])
      setTestsLoading(false)
    }
    loadTests()
  }, [activeSection])

  useEffect(() => {
    if (activeSection !== 'programs') return
    loadPrograms()
  }, [activeSection])

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

  const addAthletesToCoachTeam = async (teamId) => {
    if (!teamId || coachAddSelected.length === 0) return
    try {
      const inserts = coachAddSelected.map((athlete_id) => ({ team_id: teamId, athlete_id }))
      console.log('[Coaches] Inserting athletes:', coachAddSelected, 'to team:', teamId)
      const { data, error } = await supabase.from('athlete_teams').insert(inserts)
      console.log('[Coaches] Insert result:', data, error)
      setCoachAddSelected([])
      await loadTeamRoster(teamId)
    } catch (err) {
      console.error('Add athletes to coach team failed', err)
    }
  }

  const handleReassignCoach = async (coach, teamId) => {
    try {
      await supabase.from('pfa_teams').update({ coach_id: null }).eq('coach_id', coach.id)
      if (teamId) {
        await supabase.from('pfa_teams').update({ coach_id: coach.id }).eq('id', teamId)
      }
      await loadCoaches()
    } catch (err) {
      console.error('Reassign coach failed', err)
    }
  }

  const handleRemoveCoachTeam = async (coach) => {
    if (!coach?.team?.id) return
    try {
      await supabase.from('pfa_teams').update({ coach_id: null }).eq('id', coach.team.id)
      await loadCoaches()
    } catch (err) {
      console.error('Remove coach from team failed', err)
    }
  }

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
    if (!window.confirm('Delete this team? Athletes on this team will NOT be deleted — they will just be unassigned.')) return
    try {
      const { error: linkError } = await supabase
        .from('athlete_teams')
        .delete()
        .eq('team_id', id)
      if (linkError) {
        alert('Failed to remove athlete team links: ' + linkError.message)
        return
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .update({ team_id: null })
        .eq('team_id', id)
      if (profileError) {
        alert('Failed to unlink profiles: ' + profileError.message)
        return
      }

      const { error: sessionError } = await supabase
        .from('test_sessions')
        .update({ team_id: null })
        .eq('team_id', id)
      if (sessionError) {
        alert('Failed to unlink test sessions: ' + sessionError.message)
        return
      }

      const { error: teamError } = await supabase
        .from('pfa_teams')
        .delete()
        .eq('id', id)
      if (teamError) {
        alert('Failed to delete team: ' + teamError.message)
        return
      }

      loadTeams()
      loadMetrics()
    } catch (err) {
      alert('Unexpected error: ' + err.message)
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
                  <td className="py-3 px-3">
                    {athleteTeamsMap[u.id]?.[0]?.pfa_teams?.name
                      || teams.find(t => t.coach_id === u.id)?.name
                      || u.pfa_teams?.name
                      || '-'}
                  </td>
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
                    <td className="py-3 px-3">{t.coachName || '—'}</td>
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
                                      <td
                                        className="py-2 px-3"
                                        style={{ cursor: 'pointer', color: '#3fae52', textDecoration: 'underline' }}
                                        onClick={async () => {
                                          const athlete = r.profiles || { athlete_id: r.athlete_id, full_name: r.full_name || 'Unknown' }
                                          const athleteId = r.athlete_id || r.profiles?.id || athlete.id
                                          const athleteName = r.profiles?.full_name || r.full_name || athlete.full_name || 'Unknown'
                                          console.log('[CardModal] athlete object:', athlete)
                                          setCardModalAthlete({ ...athlete, id: athleteId, full_name: athleteName })

                                          const { data: results } = await supabase
                                            .from('pfa_test_results')
                                            .select('*')
                                            .eq('athlete_id', athleteId)
                                            .order('date_tested', { ascending: false })
                                          setCardModalResults(results || [])
                                          console.log('[CardModal] results for', athleteName, ':', results)
                                          console.log('[CardModal] first result date:', results?.[0]?.date_tested)
                                          console.log(
                                            '[CardModal] season year:',
                                            results?.[0]?.date_tested ? getCardModalSeasonYear(results[0].date_tested) : 'no results'
                                          )

                                          const { data: measurements } = await supabase
                                            .from('pfa_body_measurements')
                                            .select('*')
                                            .eq('athlete_id', athleteId)
                                            .order('measurement_date', { ascending: false })
                                          setCardModalMeasurements(measurements || [])

                                          const { data: scores } = await supabase
                                            .from('pfa_composite_scores')
                                            .select('*')
                                            .eq('athlete_id', athleteId)
                                            .order('calculated_at', { ascending: false })
                                            .limit(1)
                                          setCardModalScores(scores?.[0] || null)
                                        }}
                                      >
                                        {r.profiles?.full_name || r.full_name || '-'}
                                      </td>
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

  const renderAthletes = () => {
    const athleteResults = athleteResultsMap
    const athleteTeams = athleteTeamsMap
    const selectedTeamForAthlete = athleteTeamSelect

    const handleRemoveFromTeam = async (athleteId, teamId) => {
      await removeAthleteFromTeam(teamId, athleteId)
      const updated = await getAthleteTeams(athleteId)
      setAthleteTeamsMap((prev) => ({ ...prev, [athleteId]: updated || [] }))
    }

    const handleAddToTeam = async (athleteId) => {
      const teamId = selectedTeamForAthlete?.[athleteId]
      if (!teamId) return
      await addAthleteToTeam(athleteId, teamId)
      const updated = await getAthleteTeams(athleteId)
      setAthleteTeamsMap((prev) => ({ ...prev, [athleteId]: updated || [] }))
      setAthleteTeamSelect((prev) => ({ ...prev, [athleteId]: '' }))
    }

    return (
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
              <th className="py-3 px-3 text-left">Access</th>
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
                        loadAthleteBodyMeasurements(a.id)
                      }
                    }}
                  >
                    <td className="py-3 px-3">{a.full_name}</td>
                    <td className="py-3 px-3">{a.sport}</td>
                    <td className="py-3 px-3">{a.position || '-'}</td>
                    <td className="py-3 px-3">
                      {athleteTeams[a.id]?.[0]?.pfa_teams?.name || a.pfa_teams?.name || '-'}
                    </td>
                    <td className="py-3 px-3">{a.age_category || '-'}</td>
                    <td className="py-3 px-3">{a.competition_level || '-'}</td>
                    <td className="py-3 px-3">{a.date_of_birth?.slice(0, 10) || '-'}</td>
                    <td className="py-3 px-3" onClick={(e) => e.stopPropagation()}>
                      {a.invite_sent_at ? (
                        <span style={{ fontSize: '11px', color: '#3fae52', fontWeight: 600 }}>
                          ✓ Invited {new Date(a.invite_sent_at).toLocaleDateString()}
                        </span>
                      ) : a.email && !a.email.includes('@peakathletics.app') ? (
                        <button
                          onClick={async (e) => {
                            e.stopPropagation()
                            if (!window.confirm(`Send invite to ${a.full_name} at ${a.email}?`)) return
                            try {
                              const res = await fetch('/.netlify/functions/send-athlete-invite', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ athleteId: a.id, email: a.email, fullName: a.full_name }),
                              })
                              const data = await res.json()
                              if (data.success) {
                                alert(`Invite sent to ${a.email}`)
                                window.location.reload()
                              } else {
                                alert(`Error: ${data.error}`)
                              }
                            } catch (err) {
                              alert('Failed to send invite: ' + err.message)
                            }
                          }}
                          style={{
                            background: 'rgba(63,174,82,0.15)',
                            border: '1px solid rgba(63,174,82,0.4)',
                            borderRadius: '6px',
                            color: '#3fae52',
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '4px 10px',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          Send Invite
                        </button>
                      ) : (
                        <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)' }}>No email</span>
                      )}
                    </td>
                  </tr>
                  {expandedAthleteId === a.id && (() => {
                    const results = athleteResults[a.id] || []
                    const bodyRows = athleteBodyMap[a.id] || []
                    const isEditingThis = editingAthleteId === a.id
                    const isUnder18 = a.date_of_birth && ((new Date() - new Date(a.date_of_birth)) / (1000 * 60 * 60 * 24 * 365)) < 18

                    const fieldStyle = {
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(63,174,82,0.25)',
                      borderRadius: '6px',
                      color: 'white',
                      padding: '6px 10px',
                      fontSize: '12px',
                      width: '100%',
                    }
                    const selectStyle = { ...fieldStyle }
                    const labelStyle = { fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.08em' }
                    const fieldGroup = (label, content) => (
                      <div style={{ marginBottom: '12px' }}>
                        <div style={labelStyle}>{label}</div>
                        {content}
                      </div>
                    )

                    const grouped = results.reduce((acc, r) => {
                      if (!acc[r.category]) acc[r.category] = []
                      acc[r.category].push(r)
                      return acc
                    }, {})

                    return (
                      <tr className="bg-white/5">
                        <td colSpan="7" style={{ padding: '0', background: 'rgba(0,0,0,0.3)' }}>
                          <div style={{ padding: '20px 24px' }}>

                            {/* HEADER ROW */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                              <div style={{ fontSize: '15px', fontWeight: '700', color: 'white' }}>{a.full_name}</div>
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                {athleteSaveStatus === 'saved' && <span style={{ color: '#3fae52', fontSize: '12px' }}>✓ Saved</span>}
                                {isEditingThis ? (
                                  <>
                                    <button onClick={() => handleSaveAthlete(a.id)}
                                      style={{ background: 'rgba(63,174,82,0.2)', border: '1px solid rgba(63,174,82,0.4)', borderRadius: '6px', color: '#3fae52', padding: '6px 16px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
                                      Save
                                    </button>
                                    <button onClick={() => setEditingAthleteId(null)}
                                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'rgba(255,255,255,0.5)', padding: '6px 12px', fontSize: '12px', cursor: 'pointer' }}>
                                      Cancel
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      onClick={() => window.open(`/report?id=${a.id}`, '_blank')}
                                      style={{
                                        background: 'rgba(63,174,82,0.15)',
                                        border: '1px solid rgba(63,174,82,0.4)',
                                        borderRadius: '6px',
                                        color: '#3fae52',
                                        padding: '6px 14px',
                                        fontSize: '13px',
                                        cursor: 'pointer',
                                        marginRight: '8px'
                                      }}
                                    >
                                      View Report
                                    </button>
                                    <button onClick={() => { setEditingAthleteId(a.id); setEditingAthleteData({ ...a }) }}
                                      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', color: 'rgba(255,255,255,0.7)', padding: '6px 16px', fontSize: '12px', cursor: 'pointer' }}>
                                      Edit Athlete
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>

                            {/* ATHLETE INFO */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
                              
                              {/* Col 1 — Identity */}
                              <div>
                                <div style={{ fontSize: '11px', fontWeight: '700', color: '#3fae52', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px' }}>Identity</div>
                                {fieldGroup('Full Name', isEditingThis
                                  ? <input style={fieldStyle} value={editingAthleteData.full_name || ''} onChange={e => setEditingAthleteData(p => ({ ...p, full_name: e.target.value }))} />
                                  : <div style={{ fontSize: '13px', color: 'white' }}>{a.full_name}</div>
                                )}
                                {fieldGroup('Email', isEditingThis
                                  ? <input style={fieldStyle} value={editingAthleteData.email || ''} onChange={e => setEditingAthleteData(p => ({ ...p, email: e.target.value }))} />
                                  : <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>{a.email || '—'}</div>
                                )}
                                {fieldGroup('Phone', isEditingThis
                                  ? <input style={fieldStyle} value={editingAthleteData.phone || ''} onChange={e => setEditingAthleteData(p => ({ ...p, phone: e.target.value }))} />
                                  : <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>{a.phone || '—'}</div>
                                )}
                                {fieldGroup('Date of Birth', isEditingThis
                                  ? <input type="date" style={fieldStyle} value={editingAthleteData.date_of_birth || ''} onChange={e => setEditingAthleteData(p => ({ ...p, date_of_birth: e.target.value }))} />
                                  : <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>{a.date_of_birth || '—'}</div>
                                )}
                                {fieldGroup('Gender', isEditingThis
                                  ? <select style={selectStyle} value={editingAthleteData.gender || ''} onChange={e => setEditingAthleteData(p => ({ ...p, gender: e.target.value }))}>
                                      <option value="">Select</option>
                                      <option value="male">Male</option>
                                      <option value="female">Female</option>
                                    </select>
                                  : <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>{a.gender || '—'}</div>
                                )}
                              </div>

                              {/* Col 2 — Sport Profile */}
                              <div>
                                <div style={{ fontSize: '11px', fontWeight: '700', color: '#3fae52', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px' }}>Sport Profile</div>
                                {fieldGroup('Sport', isEditingThis
                                  ? <select style={selectStyle} value={editingAthleteData.sport || ''} onChange={e => setEditingAthleteData(p => ({ ...p, sport: e.target.value }))}>
                                      <option value="">Select</option>
                                      {SPORTS.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                  : <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>{a.sport || '—'}</div>
                                )}
                                {fieldGroup('Position', isEditingThis
                                  ? <input style={fieldStyle} value={editingAthleteData.position || ''} onChange={e => setEditingAthleteData(p => ({ ...p, position: e.target.value }))} />
                                  : <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>{a.position || '—'}</div>
                                )}
                                {fieldGroup('Age Category', isEditingThis
                                  ? <select style={selectStyle} value={editingAthleteData.age_category || ''} onChange={e => setEditingAthleteData(p => ({ ...p, age_category: e.target.value }))}>
                                      <option value="">Select</option>
                                      {AGE_CATEGORIES.map(aCat => <option key={aCat} value={aCat}>{aCat}</option>)}
                                    </select>
                                  : <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>{a.age_category || '—'}</div>
                                )}
                                {fieldGroup('Competition Level', isEditingThis
                                  ? <select style={selectStyle} value={editingAthleteData.competition_level || ''} onChange={e => setEditingAthleteData(p => ({ ...p, competition_level: e.target.value }))}>
                                      <option value="">Select</option>
                                      <option value="AAA">AAA</option>
                                      <option value="AA">AA</option>
                                      <option value="A">A</option>
                                      <option value="Recreational">Recreational</option>
                                    </select>
                                  : <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>{a.competition_level || '—'}</div>
                                )}
                                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginTop: '16px' }}>
                                  Created: {a.created_at ? new Date(a.created_at).toLocaleDateString() : '—'}<br />
                                  Updated: {a.updated_at ? new Date(a.updated_at).toLocaleDateString() : '—'}
                                </div>
                              </div>

                              {/* Col 3 — Parent/Guardian (shown if under 18 or editing) */}
                              <div>
                                <div style={{ fontSize: '11px', fontWeight: '700', color: '#3fae52', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px' }}>
                                  Parent / Guardian
                                  {!isUnder18 && !isEditingThis && <span style={{ color: 'rgba(255,255,255,0.25)', fontWeight: '400', marginLeft: '6px' }}>(18+)</span>}
                                </div>
                                {fieldGroup('Parent Name', isEditingThis
                                  ? <input style={fieldStyle} value={editingAthleteData.parent_name || ''} onChange={e => setEditingAthleteData(p => ({ ...p, parent_name: e.target.value }))} />
                                  : <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>{a.parent_name || '—'}</div>
                                )}
                                {fieldGroup('Parent Email', isEditingThis
                                  ? <input style={fieldStyle} value={editingAthleteData.parent_email || ''} onChange={e => setEditingAthleteData(p => ({ ...p, parent_email: e.target.value }))} />
                                  : <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>{a.parent_email || '—'}</div>
                                )}
                                {fieldGroup('Parent Phone', isEditingThis
                                  ? <input style={fieldStyle} value={editingAthleteData.parent_phone || ''} onChange={e => setEditingAthleteData(p => ({ ...p, parent_phone: e.target.value }))} />
                                  : <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>{a.parent_phone || '—'}</div>
                                )}
                              </div>
                            </div>

                            {/* TEAMS */}
                            <div style={{ marginBottom: '24px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                              <div style={{ fontSize: '11px', fontWeight: '700', color: '#3fae52', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px' }}>Teams & Groups</div>
                              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
                                {(athleteTeams[a.id] || []).map(team => (
                                  <div key={team.team_id} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(63,174,82,0.12)', border: '1px solid rgba(63,174,82,0.25)', borderRadius: '20px', padding: '4px 12px', fontSize: '12px', color: '#3fae52' }}>
                                    {team.pfa_teams?.name || team.pfa_teams?.id || team.team_id}
                                    <button onClick={() => handleRemoveFromTeam(a.id, team.team_id)}
                                      style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: '0', fontSize: '12px', lineHeight: 1 }}>✕</button>
                                  </div>
                                ))}
                                {(athleteTeams[a.id] || []).length === 0 && (
                                  <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>No teams assigned</div>
                                )}
                              </div>
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <select style={{ background: '#f5f5f5', border: '1px solid rgba(63,174,82,0.25)', borderRadius: '6px', color: '#0a0f0a', padding: '6px 10px', fontSize: '12px' }}
                                  value={selectedTeamForAthlete?.[a.id] || ''}
                                  onChange={e => setAthleteTeamSelect(prev => ({ ...prev, [a.id]: e.target.value }))}>
                                  <option value="">Add to team...</option>
                                  {teams
                                    .filter(t => !(athleteTeams[a.id] || []).some(at => at.team_id === t.id))
                                    .map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                </select>
                                <button onClick={() => handleAddToTeam(a.id)}
                                  style={{ background: 'rgba(63,174,82,0.15)', border: '1px solid rgba(63,174,82,0.3)', borderRadius: '6px', color: '#3fae52', padding: '6px 14px', fontSize: '12px', cursor: 'pointer' }}>
                                  Add
                                </button>
                              </div>
                            </div>

                            {/* TEST RESULTS */}
                            <div style={{ paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                              <div style={{ fontSize: '11px', fontWeight: '700', color: '#3fae52', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '14px' }}>Test Results</div>
                              {Object.keys(grouped).length === 0 && (
                                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>No test results recorded.</div>
                              )}
                              {Object.entries(grouped).map(([category, catResults]) => {
                                const sortedResults = [...catResults].sort((a, b) => new Date(b.date_tested) - new Date(a.date_tested))
                                const showAll = showAllResults[`${a.id}-${category}`]
                                const displayResults = showAll ? sortedResults : sortedResults.slice(0, 5)

                                return (
                                  <div key={category} style={{ marginBottom: '16px' }}>
                                    <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>{category}</div>
                                    <div style={{ border: '1px solid rgba(255,255,255,0.07)', borderRadius: '8px', overflow: 'hidden' }}>
                                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                        <thead>
                                          <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                                            {['Date', 'Test', 'Value', 'Load', 'Reps', 'Unit', ''].map(h => (
                                              <th key={h} style={{ padding: '7px 10px', textAlign: 'left', color: 'rgba(255,255,255,0.35)', fontWeight: '600', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</th>
                                            ))}
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {displayResults.map(result => (
                                            <tr key={result.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                              {editingResultId === result.id ? (
                                                <>
                                                  <td style={{ padding: '6px 10px' }}>
                                                    <input type="date" value={editingResultData.date_tested?.slice(0,10) || ''} onChange={e => setEditingResultData(p => ({ ...p, date_tested: e.target.value }))}
                                                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(63,174,82,0.3)', borderRadius: '4px', color: 'white', padding: '3px 6px', fontSize: '11px', width: '110px' }} />
                                                  </td>
                                                  <td style={{ padding: '6px 10px', color: 'rgba(255,255,255,0.5)' }}>{result.test_type}</td>
                                                  <td style={{ padding: '6px 10px' }}>
                                                    <input type="number" step="0.01" value={editingResultData.value || ''} onChange={e => setEditingResultData(p => ({ ...p, value: e.target.value }))}
                                                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(63,174,82,0.3)', borderRadius: '4px', color: 'white', padding: '3px 6px', fontSize: '11px', width: '70px' }} />
                                                  </td>
                                                  <td style={{ padding: '6px 10px' }}>
                                                    <input type="number" step="0.5" value={editingResultData.load_value || ''} onChange={e => setEditingResultData(p => ({ ...p, load_value: e.target.value }))}
                                                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(63,174,82,0.3)', borderRadius: '4px', color: 'white', padding: '3px 6px', fontSize: '11px', width: '70px' }} />
                                                  </td>
                                                  <td style={{ padding: '6px 10px' }}>
                                                    <input type="number" value={editingResultData.reps || ''} onChange={e => setEditingResultData(p => ({ ...p, reps: e.target.value }))}
                                                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(63,174,82,0.3)', borderRadius: '4px', color: 'white', padding: '3px 6px', fontSize: '11px', width: '50px' }} />
                                                  </td>
                                                  <td style={{ padding: '6px 10px' }}>
                                                    <select value={editingResultData.unit || ''} onChange={e => setEditingResultData(p => ({ ...p, unit: e.target.value }))}
                                                      style={{ background: '#f5f5f5', border: '1px solid rgba(63,174,82,0.3)', borderRadius: '4px', color: '#0a0f0a', padding: '3px 6px', fontSize: '11px', width: '80px' }}>
                                                      <option value="">Unit</option>
                                                      {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                                                    </select>
                                                  </td>
                                                  <td style={{ padding: '6px 10px' }}>
                                                    <div style={{ display: 'flex', gap: '5px' }}>
                                                      <button onClick={handleSaveResult}
                                                        style={{ background: 'rgba(63,174,82,0.2)', border: '1px solid rgba(63,174,82,0.4)', borderRadius: '4px', color: '#3fae52', padding: '3px 9px', fontSize: '11px', cursor: 'pointer' }}>Save</button>
                                                      <button onClick={() => { setEditingResultId(null); setEditingResultData({}) }}
                                                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: 'rgba(255,255,255,0.4)', padding: '3px 7px', fontSize: '11px', cursor: 'pointer' }}>✕</button>
                                                    </div>
                                                  </td>
                                                </>
                                              ) : (
                                                <>
                                                  <td style={{ padding: '7px 10px', color: 'rgba(255,255,255,0.5)' }}>{result.date_tested ? new Date(result.date_tested).toLocaleDateString() : '—'}</td>
                                                  <td style={{ padding: '7px 10px', color: 'rgba(255,255,255,0.8)' }}>{result.test_type?.replace(/_/g, ' ')}</td>
                                                  <td style={{ padding: '7px 10px', color: 'white', fontWeight: '600' }}>{result.value ?? '—'}</td>
                                                  <td style={{ padding: '7px 10px', color: 'rgba(255,255,255,0.6)' }}>{result.load_value ?? '—'}</td>
                                                  <td style={{ padding: '7px 10px', color: 'rgba(255,255,255,0.6)' }}>{result.reps ?? '—'}</td>
                                                  <td style={{ padding: '7px 10px', color: 'rgba(255,255,255,0.4)' }}>{result.unit || '—'}</td>
                                                  <td style={{ padding: '7px 10px' }}>
                                                    <button onClick={() => { setEditingResultId(result.id); setEditingResultData({ ...result, athlete_id: a.id }) }}
                                                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', color: 'rgba(255,255,255,0.5)', padding: '3px 9px', fontSize: '11px', cursor: 'pointer' }}>
                                                      Edit
                                                    </button>
                                                  </td>
                                                </>
                                              )}
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                    {sortedResults.length > 5 && (
                                      <button onClick={() => setShowAllResults(prev => ({ ...prev, [`${a.id}-${category}`]: !showAll }))}
                                        style={{ marginTop: '6px', background: 'none', border: 'none', color: '#3fae52', fontSize: '11px', cursor: 'pointer', padding: '0' }}>
                                        {showAll ? '▲ Show less' : `▼ Show all ${sortedResults.length} results`}
                                      </button>
                                    )}
                                  </div>
                                )
                              })}
                            </div>

                            {/* BODY MEASUREMENTS */}
                            <div style={{ paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                              <div style={{ fontSize: '11px', fontWeight: '700', color: '#3fae52', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '14px' }}>Body Measurements</div>
                              {bodyRows.length === 0 ? (
                                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>No body measurements recorded.</div>
                              ) : (
                                <div style={{ border: '1px solid rgba(255,255,255,0.07)', borderRadius: '8px', overflow: 'hidden' }}>
                                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                    <thead>
                                      <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                                        {['Date', 'Weight (lbs)', 'Body Fat %', 'Muscle Mass (lbs)', 'Height (in)'].map(h => (
                                          <th key={h} style={{ padding: '7px 10px', textAlign: 'left', color: 'rgba(255,255,255,0.35)', fontWeight: '600', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {bodyRows.map(row => (
                                        <tr key={row.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                          {editingBodyId === row.id ? (
                                            <>
                                              <td style={{ padding: '7px 10px' }}>
                                                <input type="date" value={editingBodyData.measurement_date?.slice(0,10) || ''} onChange={e => setEditingBodyData(p => ({ ...p, measurement_date: e.target.value }))}
                                                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(63,174,82,0.3)', borderRadius: '4px', color: 'white', padding: '3px 6px', fontSize: '11px', width: '120px' }} />
                                              </td>
                                              <td style={{ padding: '7px 10px' }}>
                                                <input type="number" step="0.1" value={editingBodyData.weight || ''} onChange={e => setEditingBodyData(p => ({ ...p, weight: e.target.value }))}
                                                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(63,174,82,0.3)', borderRadius: '4px', color: 'white', padding: '3px 6px', fontSize: '11px', width: '90px' }} />
                                              </td>
                                              <td style={{ padding: '7px 10px' }}>
                                                <input type="number" step="0.1" value={editingBodyData.body_fat_percentage || ''} onChange={e => setEditingBodyData(p => ({ ...p, body_fat_percentage: e.target.value }))}
                                                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(63,174,82,0.3)', borderRadius: '4px', color: 'white', padding: '3px 6px', fontSize: '11px', width: '90px' }} />
                                              </td>
                                              <td style={{ padding: '7px 10px' }}>
                                                <input type="number" step="0.1" value={editingBodyData.muscle_mass || ''} onChange={e => setEditingBodyData(p => ({ ...p, muscle_mass: e.target.value }))}
                                                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(63,174,82,0.3)', borderRadius: '4px', color: 'white', padding: '3px 6px', fontSize: '11px', width: '90px' }} />
                                              </td>
                                              <td style={{ padding: '7px 10px' }}>
                                                <input type="number" step="0.5" value={editingBodyData.height || ''} onChange={e => setEditingBodyData(p => ({ ...p, height: e.target.value }))}
                                                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(63,174,82,0.3)', borderRadius: '4px', color: 'white', padding: '3px 6px', fontSize: '11px', width: '90px' }} />
                                              </td>
                                              <td style={{ padding: '7px 10px' }}>
                                                <div style={{ display: 'flex', gap: '5px' }}>
                                                  <button onClick={saveBodyMeasurement}
                                                    style={{ background: 'rgba(63,174,82,0.2)', border: '1px solid rgba(63,174,82,0.4)', borderRadius: '4px', color: '#3fae52', padding: '3px 9px', fontSize: '11px', cursor: 'pointer' }}>Save</button>
                                                  <button onClick={() => { setEditingBodyId(null); setEditingBodyData({}) }}
                                                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: 'rgba(255,255,255,0.4)', padding: '3px 7px', fontSize: '11px', cursor: 'pointer' }}>✕</button>
                                                </div>
                                              </td>
                                            </>
                                          ) : (
                                            <>
                                              <td style={{ padding: '7px 10px', color: 'rgba(255,255,255,0.6)' }}>{row.measurement_date ? new Date(row.measurement_date).toLocaleDateString() : '—'}</td>
                                              <td style={{ padding: '7px 10px', color: 'white', fontWeight: '600' }}>{row.weight ?? '—'}</td>
                                              <td style={{ padding: '7px 10px', color: 'rgba(255,255,255,0.8)' }}>{row.body_fat_percentage ?? '—'}</td>
                                              <td style={{ padding: '7px 10px', color: 'rgba(255,255,255,0.8)' }}>{row.muscle_mass != null ? Number(row.muscle_mass).toFixed(2) : '—'}</td>
                                              <td style={{ padding: '7px 10px', color: 'rgba(255,255,255,0.8)' }}>{row.height ?? '—'}</td>
                                              <td style={{ padding: '7px 10px' }}>
                                                <button onClick={() => { setEditingBodyId(row.id); setEditingBodyData({ ...row, athlete_id: a.id }) }}
                                                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', color: 'rgba(255,255,255,0.5)', padding: '3px 9px', fontSize: '11px', cursor: 'pointer' }}>
                                                  Edit
                                                </button>
                                              </td>
                                            </>
                                          )}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>

                          </div>
                        </td>
                      </tr>
                    )
                  })()}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
  }

  const renderTests = () => {
    const inputStyle = {
      background: 'rgba(255,255,255,0.05)',
      border: '1px solid rgba(63,174,82,0.3)',
      borderRadius: '6px',
      color: 'white',
      padding: '6px 10px',
      fontSize: '12px',
    }
    const selectStyle = { ...inputStyle, color: '#0a0f0a', background: '#f5f5f5' }
    const sectionHeader = (text) => (
      <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.12em', color: '#3fae52', textTransform: 'uppercase', marginBottom: '14px' }}>{text}</div>
    )

    const handleSaveTest = async (test) => {
      const { error } = await supabase.from('pfa_tests').update({
        display_name: test.display_name,
        category: test.category,
        unit: test.unit,
        lower_is_better: test.lower_is_better,
        is_load_based: test.is_load_based,
        is_active: test.is_active,
        updated_at: new Date().toISOString()
      }).eq('id', test.id)
      if (!error) {
        setTests((prev) => prev.map((t) => t.id === test.id ? test : t))
        setEditingTest(null)
        setTestsSaved('edited')
        setTimeout(() => setTestsSaved(''), 3000)
      }
    }

    const handleAddTest = async () => {
      if (!newTest.test_type || !newTest.display_name) return
      const { data, error } = await supabase.from('pfa_tests').insert({
        ...newTest,
        test_type: newTest.test_type.toLowerCase().replace(/\s+/g, '_'),
        updated_at: new Date().toISOString()
      }).select().single()
      if (!error && data) {
        setTests((prev) => [...prev, data])
        setNewTest({ test_type: '', display_name: '', category: 'strength', unit: 'lbs', lower_is_better: false, is_load_based: false, is_active: true })
        setTestsSaved('added')
        setTimeout(() => setTestsSaved(''), 3000)

        if (['strength', 'power'].includes(data.category)) {
          await supabase.from('pfa_test_weights').upsert({
            category: data.category,
            test_type: data.test_type,
            weight: 0,
            is_active: true,
            sport: 'default',
            age_category: 'default',
            gender: 'all',
          }, { onConflict: 'category,test_type,sport,age_category' })
        }
      }
    }

    const handleToggleActive = async (test) => {
      const updated = { ...test, is_active: !test.is_active }
      await supabase.from('pfa_tests').update({ is_active: updated.is_active }).eq('id', test.id)
      setTests((prev) => prev.map((t) => t.id === test.id ? updated : t))
    }

    const handleDeleteTest = async (test) => {
      if (!window.confirm(`Delete "${test.display_name}"? This will not delete existing test results.`)) return
      await supabase.from('pfa_tests').delete().eq('id', test.id)
      setTests((prev) => prev.filter((t) => t.id !== test.id))
    }

    const grouped = CATEGORIES.reduce((acc, cat) => {
      acc[cat] = tests.filter((t) => t.category === cat)
      return acc
    }, {})

    return (
      <div style={{ padding: '24px', maxWidth: '800px' }}>
        <h2 style={{ color: 'white', fontSize: '18px', fontWeight: '700', marginBottom: '4px' }}>Tests</h2>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', marginBottom: '28px' }}>
          Manage all available test types. Adding a new test to a multi-test category (Strength, Power) will automatically add it to the default test weights with a weight of 0% — update the weight in Score Weights after adding.
        </p>

        {testsLoading ? (
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>Loading tests...</div>
        ) : (<>

          {/* TESTS BY CATEGORY */}
          {CATEGORIES.map((category) => (
            <div key={category} style={{ marginBottom: '24px' }}>
              {sectionHeader(category)}
              <div style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}>
                      {['Display Name', 'Test Type', 'Unit', 'Lower is Better', 'Load Based', 'Active', ''].map((h) => (
                        <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: 'rgba(255,255,255,0.4)', fontWeight: '600', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {grouped[category].length === 0 && (
                      <tr>
                        <td colSpan="7" style={{ padding: '14px 12px', color: 'rgba(255,255,255,0.25)', fontStyle: 'italic' }}>No tests in this category.</td>
                      </tr>
                    )}
                    {grouped[category].map((test) => (
                      <tr key={test.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', opacity: test.is_active ? 1 : 0.45 }}>
                        {editingTest?.id === test.id ? (
                          <>
                            <td style={{ padding: '8px 12px' }}>
                              <input value={editingTest.display_name} onChange={(e) => setEditingTest((prev) => ({ ...prev, display_name: e.target.value }))} style={{ ...inputStyle, width: '130px' }} />
                            </td>
                            <td style={{ padding: '8px 12px', color: 'rgba(255,255,255,0.4)' }}>{test.test_type}</td>
                            <td style={{ padding: '8px 12px' }}>
                              <select value={editingTest.unit} onChange={(e) => setEditingTest((prev) => ({ ...prev, unit: e.target.value }))} style={{ ...selectStyle, width: '70px' }}>
                                {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                              </select>
                            </td>
                            <td style={{ padding: '8px 12px' }}>
                              <input type="checkbox" checked={editingTest.lower_is_better} onChange={(e) => setEditingTest((prev) => ({ ...prev, lower_is_better: e.target.checked }))} />
                            </td>
                            <td style={{ padding: '8px 12px' }}>
                              <input type="checkbox" checked={editingTest.is_load_based} onChange={(e) => setEditingTest((prev) => ({ ...prev, is_load_based: e.target.checked }))} />
                            </td>
                            <td style={{ padding: '8px 12px' }}>
                              <input type="checkbox" checked={editingTest.is_active} onChange={(e) => setEditingTest((prev) => ({ ...prev, is_active: e.target.checked }))} />
                            </td>
                            <td style={{ padding: '8px 12px' }}>
                              <div style={{ display: 'flex', gap: '6px' }}>
                                <button onClick={() => handleSaveTest(editingTest)} style={{ background: 'rgba(63,174,82,0.2)', border: '1px solid rgba(63,174,82,0.4)', borderRadius: '4px', color: '#3fae52', padding: '3px 10px', fontSize: '11px', cursor: 'pointer' }}>Save</button>
                                <button onClick={() => setEditingTest(null)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: 'rgba(255,255,255,0.5)', padding: '3px 10px', fontSize: '11px', cursor: 'pointer' }}>Cancel</button>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td style={{ padding: '10px 12px', color: 'white', fontWeight: '500' }}>{test.display_name}</td>
                            <td style={{ padding: '10px 12px', color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' }}>{test.test_type}</td>
                            <td style={{ padding: '10px 12px', color: 'rgba(255,255,255,0.6)' }}>{test.unit}</td>
                            <td style={{ padding: '10px 12px', color: test.lower_is_better ? '#3fae52' : 'rgba(255,255,255,0.25)' }}>{test.lower_is_better ? '✓' : '—'}</td>
                            <td style={{ padding: '10px 12px', color: test.is_load_based ? '#3fae52' : 'rgba(255,255,255,0.25)' }}>{test.is_load_based ? '✓' : '—'}</td>
                            <td style={{ padding: '10px 12px' }}>
                              <button onClick={() => handleToggleActive(test)} style={{ background: test.is_active ? 'rgba(63,174,82,0.15)' : 'rgba(255,255,255,0.05)', border: `1px solid ${test.is_active ? 'rgba(63,174,82,0.3)' : 'rgba(255,255,255,0.1)'}`, borderRadius: '4px', color: test.is_active ? '#3fae52' : 'rgba(255,255,255,0.3)', padding: '2px 8px', fontSize: '11px', cursor: 'pointer' }}>
                                {test.is_active ? 'Active' : 'Inactive'}
                              </button>
                            </td>
                            <td style={{ padding: '10px 12px' }}>
                              <div style={{ display: 'flex', gap: '6px' }}>
                                <button onClick={() => setEditingTest({ ...test })} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px', color: 'rgba(255,255,255,0.6)', padding: '3px 10px', fontSize: '11px', cursor: 'pointer' }}>Edit</button>
                                <button onClick={() => handleDeleteTest(test)} style={{ background: 'rgba(224,92,42,0.1)', border: '1px solid rgba(224,92,42,0.25)', borderRadius: '4px', color: '#e05c2a', padding: '3px 10px', fontSize: '11px', cursor: 'pointer' }}>Delete</button>
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          {/* ADD NEW TEST */}
          <div style={{ padding: '20px', background: 'rgba(63,174,82,0.05)', border: '1px solid rgba(63,174,82,0.2)', borderRadius: '12px', marginTop: '8px' }}>
            {sectionHeader('Add New Test')}
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '12px', alignItems: 'flex-end' }}>
              <div>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginBottom: '4px' }}>Display Name</div>
                <input value={newTest.display_name} onChange={(e) => setNewTest((prev) => ({ ...prev, display_name: e.target.value }))} placeholder="e.g. 40 Yard Dash" style={{ ...inputStyle, width: '150px' }} />
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginBottom: '4px' }}>Test Type Key</div>
                <input value={newTest.test_type} onChange={(e) => setNewTest((prev) => ({ ...prev, test_type: e.target.value }))} placeholder="e.g. 40_yard_dash" style={{ ...inputStyle, width: '140px' }} />
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginBottom: '4px' }}>Category</div>
                <select value={newTest.category} onChange={(e) => setNewTest((prev) => ({ ...prev, category: e.target.value }))} style={{ ...selectStyle, width: '110px' }}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginBottom: '4px' }}>Unit</div>
                <select value={newTest.unit} onChange={(e) => setNewTest((prev) => ({ ...prev, unit: e.target.value }))} style={{ ...selectStyle, width: '80px' }}>
                  {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'rgba(255,255,255,0.7)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={newTest.lower_is_better} onChange={(e) => setNewTest((prev) => ({ ...prev, lower_is_better: e.target.checked }))} />
                  Lower is Better
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'rgba(255,255,255,0.7)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={newTest.is_load_based} onChange={(e) => setNewTest((prev) => ({ ...prev, is_load_based: e.target.checked }))} />
                  Load Based
                </label>
              </div>
            </div>

            {['strength', 'power'].includes(newTest.category) && (
              <div style={{ fontSize: '12px', color: '#f5a623', marginBottom: '12px', padding: '8px 12px', background: 'rgba(245,166,35,0.08)', borderRadius: '6px', border: '1px solid rgba(245,166,35,0.2)' }}>
                ⚠ This test will be added to the {newTest.category} test weights with 0% — remember to update the weight distribution in Score Weights after adding.
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button onClick={handleAddTest} disabled={!newTest.test_type || !newTest.display_name}
                style={{ background: 'rgba(63,174,82,0.2)', border: '1px solid rgba(63,174,82,0.4)', borderRadius: '8px', color: '#3fae52', padding: '8px 20px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', opacity: (!newTest.test_type || !newTest.display_name) ? 0.4 : 1 }}>
                Add Test
              </button>
              {testsSaved === 'added' && <span style={{ color: '#3fae52', fontSize: '13px' }}>✓ Test added</span>}
              {testsSaved === 'edited' && <span style={{ color: '#3fae52', fontSize: '13px' }}>✓ Test updated</span>}
            </div>
          </div>

        </>)}
      </div>
    )
  }

  const renderScoreWeights = () => {
    const catTotal = Object.values(defaultCatWeights).reduce((s, v) => s + Number(v), 0)
    const newCustomTotal = ['speed', 'strength', 'power', 'agility', 'endurance'].reduce((s, k) => s + Number(newCustom[k] || 0), 0)

    const inputStyle = {
      width: '60px', background: 'rgba(255,255,255,0.05)',
      border: '1px solid rgba(63,174,82,0.3)', borderRadius: '6px',
      color: 'white', padding: '5px 8px', fontSize: '12px', textAlign: 'center'
    }
    const selectStyle = {
      background: '#0a0f0a', border: '1px solid rgba(63,174,82,0.3)',
      borderRadius: '6px', color: '#fff', padding: '6px 10px', fontSize: '12px'
    }
    const sectionHeader = (text) => (
      <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.12em', color: '#3fae52', textTransform: 'uppercase', marginBottom: '14px' }}>{text}</div>
    )
    const totalIndicator = (total) => (
      <div style={{ fontSize: '12px', color: total === 100 ? '#3fae52' : '#e05c2a', marginBottom: '12px', fontWeight: '600' }}>
        Total: {total}% {total !== 100 ? '— must equal 100%' : '✓'}
      </div>
    )

    const catWeightRows = (weights, onChange) => (
      Object.entries(weights).filter(([k]) => ['speed', 'strength', 'power', 'agility', 'endurance'].includes(k)).map(([cat, val]) => (
        <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <div style={{ width: '90px', fontSize: '13px', color: 'rgba(255,255,255,0.8)' }}>{CATEGORY_LABELS[cat]}</div>
          <input type="number" min="0" max="100" value={val} onChange={(e) => onChange(cat, Number(e.target.value))} style={inputStyle} />
          <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>%</span>
          <div style={{ flex: 1, height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px' }}>
            <div style={{ width: `${Math.min(val, 100)}%`, height: '100%', background: '#3fae52', borderRadius: '2px', transition: 'width 0.2s' }} />
          </div>
        </div>
      ))
    )

    const handleSaveDefault = async () => {
      try {
        await supabase.from('pfa_score_weights').update({
          speed_weight: defaultCatWeights.speed / 100,
          strength_weight: defaultCatWeights.strength / 100,
          power_weight: defaultCatWeights.power / 100,
          agility_weight: defaultCatWeights.agility / 100,
          endurance_weight: defaultCatWeights.endurance / 100,
          updated_at: new Date().toISOString()
        }).eq('is_default', true)

        // Deactivate tests that were removed from the UI
        const { data: existingDefaultTests } = await supabase
          .from('pfa_test_weights')
          .select('id, category, test_type')
          .eq('sport', 'default')
          .eq('age_category', 'default')
          .eq('is_active', true)

        for (const existing of (existingDefaultTests || [])) {
          const stillPresent = defaultTestWeights[existing.category]?.[existing.test_type]
          if (!stillPresent) {
            await supabase.from('pfa_test_weights')
              .update({ is_active: false, updated_at: new Date().toISOString() })
              .eq('id', existing.id)
          }
        }

        for (const [category, tests] of Object.entries(defaultTestWeights)) {
          for (const [testType, data] of Object.entries(tests)) {
            await supabase.from('pfa_test_weights').upsert({
              category, test_type: testType, weight: data.weight / 100,
              is_active: data.is_active, sport: 'default', age_category: 'default', gender: 'all',
              updated_at: new Date().toISOString()
            }, { onConflict: 'category,test_type,sport,age_category' })
          }
        }
        setWeightsSaved('default')
        setTimeout(() => setWeightsSaved(''), 3000)
      } catch (err) { console.error('Save error:', err) }
    }

    const handleAddCustom = async () => {
      if (!newCustom.sport || !newCustom.age_category || !newCustom.gender) return
      if (newCustomTotal !== 100) return
      try {
        const { data, error } = await supabase.from('pfa_score_weights').insert({
          sport: newCustom.sport,
          age_category: newCustom.age_category,
          gender: newCustom.gender,
          speed_weight: newCustom.speed / 100,
          strength_weight: newCustom.strength / 100,
          power_weight: newCustom.power / 100,
          agility_weight: newCustom.agility / 100,
          endurance_weight: newCustom.endurance / 100,
          is_default: false,
          created_by: user?.id
        }).select().single()
        if (data) setCustomWeightSets((prev) => [...prev, data])
        if (data && newCustomTestWeights) {
          for (const [category, tests] of Object.entries(newCustomTestWeights)) {
            for (const [testType, tData] of Object.entries(tests)) {
              await supabase.from('pfa_test_weights').upsert({
                category,
                test_type: testType,
                weight: (tData.weight || 0) / 100,
                is_active: true,
                sport: newCustom.sport,
                age_category: newCustom.age_category,
                gender: newCustom.gender,
                created_by: user?.id,
                updated_at: new Date().toISOString(),
              }, { onConflict: 'category,test_type,sport,age_category,gender' })
            }
          }
          const setKey = `${data.sport}|${data.age_category}|${data.gender}`
          setActiveTestWeights((prev) => {
            const next = { ...(prev[setKey] || {}) }
            for (const [category, tests] of Object.entries(newCustomTestWeights)) {
              next[category] = { ...(next[category] || {}) }
              for (const [testType, tData] of Object.entries(tests)) {
                next[category][testType] = { weight: tData.weight || 0, id: null }
              }
            }
            return { ...prev, [setKey]: next }
          })
        }
        setNewCustom({ sport: '', age_category: '', gender: '', speed: 25, strength: 25, power: 25, agility: 15, endurance: 10 })
        setNewCustomTestWeights({})
        setWeightsSaved('custom')
        setTimeout(() => setWeightsSaved(''), 3000)
      } catch (err) { console.error('Save custom error:', err) }
    }

    const handleEditWeightSet = async (row) => {
      const isDefault = row.is_default
      const editState = {
        id: row.id,
        is_default: isDefault,
        sport: row.sport,
        age_category: row.age_category,
        gender: row.gender,
        speed: Math.round((row.speed_weight || 0.25) * 100),
        strength: Math.round((row.strength_weight || 0.25) * 100),
        power: Math.round((row.power_weight || 0.25) * 100),
        agility: Math.round((row.agility_weight || 0.15) * 100),
        endurance: Math.round((row.endurance_weight || 0.1) * 100),
      }
      setEditingWeightSet(editState)

      const sport = isDefault ? 'default' : row.sport
      const age_category = isDefault ? 'default' : row.age_category
      const gender = isDefault ? 'all' : row.gender
      const { data: testW } = await supabase
        .from('pfa_test_weights')
        .select('*')
        .eq('sport', sport)
        .eq('age_category', age_category)
        .eq('gender', gender)
        .eq('is_active', true)

      const grouped = {}
      for (const r of (testW || [])) {
        if (!grouped[r.category]) grouped[r.category] = {}
        grouped[r.category][r.test_type] = { weight: Math.round(r.weight * 100), id: r.id }
      }
      for (const cat of ['strength', 'power']) {
        if (!grouped[cat]) grouped[cat] = {}
        for (const testType of Object.keys(defaultTestWeights[cat] || {})) {
          if (!grouped[cat][testType]) {
            grouped[cat][testType] = { weight: 0, id: null }
          }
        }
      }
      setEditingWeightSetTests(grouped)
    }

    const handleSaveWeightSet = async () => {
      if (!editingWeightSet) return
      const isDefault = editingWeightSet.is_default
      const sport = isDefault ? 'default' : editingWeightSet.sport
      const age_category = isDefault ? 'default' : editingWeightSet.age_category
      const gender = isDefault ? 'all' : editingWeightSet.gender

      await supabase.from('pfa_score_weights').update({
        speed_weight: editingWeightSet.speed / 100,
        strength_weight: editingWeightSet.strength / 100,
        power_weight: editingWeightSet.power / 100,
        agility_weight: editingWeightSet.agility / 100,
        endurance_weight: editingWeightSet.endurance / 100,
        updated_at: new Date().toISOString()
      }).eq('id', editingWeightSet.id)

      // Deactivate tests that were removed from the UI
      const { data: existingTests } = await supabase
        .from('pfa_test_weights')
        .select('id, category, test_type')
        .eq('sport', sport)
        .eq('age_category', age_category)
        .eq('gender', gender)
        .eq('is_active', true)

      for (const existing of (existingTests || [])) {
        const stillPresent = editingWeightSetTests[existing.category]?.[existing.test_type]
        if (!stillPresent) {
          await supabase.from('pfa_test_weights')
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .eq('id', existing.id)
        }
      }

      for (const [category, tests] of Object.entries(editingWeightSetTests)) {
        for (const [testType, data] of Object.entries(tests)) {
          await supabase.from('pfa_test_weights').upsert({
            category,
            test_type: testType,
            weight: data.weight / 100,
            is_active: true,
            sport,
            age_category,
            gender,
            updated_at: new Date().toISOString()
          }, { onConflict: 'category,test_type,sport,age_category' })
        }
      }

      if (isDefault) {
        setDefaultCatWeights({
          speed: editingWeightSet.speed,
          strength: editingWeightSet.strength,
          power: editingWeightSet.power,
          agility: editingWeightSet.agility,
          endurance: editingWeightSet.endurance,
        })
        setDefaultTestWeights(editingWeightSetTests)
      } else {
        setCustomWeightSets((prev) => prev.map((r) => r.id === editingWeightSet.id ? {
          ...r,
          speed_weight: editingWeightSet.speed / 100,
          strength_weight: editingWeightSet.strength / 100,
          power_weight: editingWeightSet.power / 100,
          agility_weight: editingWeightSet.agility / 100,
          endurance_weight: editingWeightSet.endurance / 100,
        } : r))
      }

      setEditingWeightSet(null)
      setEditingWeightSetTests({})
      setWeightsSaved('edited')
      setTimeout(() => setWeightsSaved(''), 3000)
    }

    const handleDeleteCustom = async (id) => {
      await supabase.from('pfa_score_weights').delete().eq('id', id)
      setCustomWeightSets((prev) => prev.filter((r) => r.id !== id))
    }

    const handleRecalcAll = async () => {
      setRecalcStatus('Recalculating scores for all athletes...')
      try {
        const res = await fetch('/.netlify/functions/calculate-scores', { method: 'POST' })
        if (!res.ok) throw new Error('Failed to recalculate')

        setRecalcStatus('✓ Scores recalculated — generating insights...')

        const { data: athletes, error: athleteError } = await supabase
          .from('profiles')
          .select('id')
          .eq('role', 'athlete')

        if (athleteError || !athletes?.length) {
          setRecalcStatus('✓ Scores recalculated (no athletes found for insights)')
          return
        }

        let successCount = 0
        let failCount = 0

        for (const athlete of athletes) {
          try {
            const insightRes = await fetch('/.netlify/functions/generate-analytics', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ athleteId: athlete.id, force: true })
            })
            if (insightRes.ok) {
              successCount++
            } else {
              failCount++
            }
            setRecalcStatus(`✓ Scores recalculated — generating insights (${successCount + failCount}/${athletes.length})...`)
            await new Promise((resolve) => setTimeout(resolve, 500))
          } catch (err) {
            console.error('Insight generation failed for athlete:', athlete.id, err)
            failCount++
          }
        }

        setRecalcStatus(`✓ Scores recalculated — insights generated for ${successCount} athletes${failCount > 0 ? ` (${failCount} failed)` : ''}`)

      } catch (err) {
        console.error(err)
        setRecalcStatus('Failed to recalculate scores')
      }
    }

    return (
      <div style={{ padding: '24px', maxWidth: '760px' }}>
        <h2 style={{ color: 'white', fontSize: '18px', fontWeight: '700', marginBottom: '4px' }}>Score Weights</h2>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', marginBottom: '28px' }}>
          Configure how categories and tests contribute to composite scores. Custom weights override the default for matching athlete profiles.
        </p>

        {weightsLoading ? (
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>Loading weights...</div>
        ) : (<>

          {/* DEFAULT WEIGHTS */}
          <div style={{ padding: '20px', background: 'rgba(63,174,82,0.05)', border: '1px solid rgba(63,174,82,0.2)', borderRadius: '12px', marginBottom: '28px' }}>
            {sectionHeader('Default Weights — Applies to All Athletes')}
            <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '16px' }}>Used when no custom weight set matches the athlete's sport, age category, and gender.</p>

            {totalIndicator(catTotal)}
            {catWeightRows(defaultCatWeights, (cat, val) => setDefaultCatWeights((prev) => ({ ...prev, [cat]: val })))}

            {/* Test weights for multi-test categories */}
            {Object.entries(weightableTests)
              .filter(([category, tests]) => category && category !== 'anthropometrics' && (tests?.length || 0) >= 1)
              .map(([category]) => {
                const tests = defaultTestWeights[category] || {}
                const activeTests = Object.entries(tests).filter(([, d]) => d.is_active)
                const testTotal = activeTests.reduce((s, [, d]) => s + Number(d.weight), 0)
                const unusedTests = (weightableTests[category] || []).filter((t) => !tests[t.test_type])
                return (
                  <div key={category} style={{ marginTop: '16px', padding: '14px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
                    <div style={{ fontSize: '11px', color: '#3fae52', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>
                      {CATEGORY_LABELS[category]} — Individual Test Weights
                    </div>
                    <div style={{ fontSize: '12px', color: testTotal === 100 ? '#3fae52' : '#f5a623', marginBottom: '10px' }}>
                      Total: {testTotal}% {testTotal !== 100 ? '— should equal 100%' : '✓'}
                    </div>
                    {Object.entries(tests).map(([testType, data]) => (
                      <div key={testType} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                        <div style={{ width: '150px', fontSize: '12px', color: 'rgba(255,255,255,0.8)' }}>{TEST_LABELS[testType] || (weightableTests[category] || []).find((t) => t.test_type === testType)?.display_name || testType}</div>
                        <input type="number" min="0" max="100" value={data.weight}
                          onChange={(e) => setDefaultTestWeights((prev) => ({ ...prev, [category]: { ...prev[category], [testType]: { ...data, weight: Number(e.target.value) } } }))}
                          style={inputStyle} />
                        <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>%</span>
                        <button onClick={() => setDefaultTestWeights((prev) => { const u = { ...prev[category] }; delete u[testType]; return { ...prev, [category]: u } })}
                          style={{ background: 'rgba(224,92,42,0.15)', border: '1px solid rgba(224,92,42,0.3)', borderRadius: '4px', color: '#e05c2a', padding: '3px 8px', fontSize: '11px', cursor: 'pointer' }}>
                          Remove
                        </button>
                      </div>
                    ))}
                    {unusedTests.length > 0 && (
                      <div style={{ marginTop: '8px', display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>Add:</span>
                        {unusedTests.map((t) => (
                          <button key={t.test_type} onClick={() => setDefaultTestWeights((prev) => ({ ...prev, [category]: { ...prev[category], [t.test_type]: { weight: 0, is_active: true, id: null } } }))}
                            style={{ background: 'rgba(63,174,82,0.1)', border: '1px solid rgba(63,174,82,0.3)', borderRadius: '4px', color: '#3fae52', padding: '3px 8px', fontSize: '11px', cursor: 'pointer' }}>
                            + {t.display_name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '16px' }}>
              <button onClick={handleSaveDefault} disabled={catTotal !== 100}
                style={{ background: catTotal === 100 ? 'rgba(63,174,82,0.2)' : 'rgba(255,255,255,0.05)', border: `1px solid ${catTotal === 100 ? 'rgba(63,174,82,0.5)' : 'rgba(255,255,255,0.1)'}`, borderRadius: '8px', color: catTotal === 100 ? '#3fae52' : 'rgba(255,255,255,0.3)', padding: '8px 20px', fontSize: '13px', fontWeight: '600', cursor: catTotal === 100 ? 'pointer' : 'not-allowed' }}>
                Save Default Weights
              </button>
              {weightsSaved === 'default' && <span style={{ color: '#3fae52', fontSize: '13px' }}>✓ Saved</span>}
            </div>
          </div>

          {/* ADD CUSTOM WEIGHT SET */}
          <div style={{ padding: '20px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', marginBottom: '28px' }}>
            {sectionHeader('Add Custom Weight Set')}
            <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '16px' }}>Custom weights apply only to athletes matching the selected sport, age category, and gender.</p>

            <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
              <select value={newCustom.sport} onChange={(e) => setNewCustom((prev) => ({ ...prev, sport: e.target.value }))} style={selectStyle}>
                <option value="" style={{ background: '#0d1a0e', color: '#fff' }}>Sport</option>
                {SPORTS.map((s) => <option key={s} value={s} style={{ background: '#0d1a0e', color: '#fff' }}>{s}</option>)}
              </select>
              <select value={newCustom.age_category} onChange={(e) => setNewCustom((prev) => ({ ...prev, age_category: e.target.value }))} style={selectStyle}>
                <option value="" style={{ background: '#0d1a0e', color: '#fff' }}>Age Category</option>
                <option value="all" style={{ background: '#0d1a0e', color: '#fff' }}>All Ages</option>
                {AGE_CATEGORIES.map((a) => <option key={a} value={a} style={{ background: '#0d1a0e', color: '#fff' }}>{a}</option>)}
              </select>
              <select value={newCustom.gender} onChange={(e) => setNewCustom((prev) => ({ ...prev, gender: e.target.value }))} style={selectStyle}>
                <option value="" style={{ background: '#0d1a0e', color: '#fff' }}>Gender</option>
                <option value="all" style={{ background: '#0d1a0e', color: '#fff' }}>All Genders</option>
                {GENDERS.map((g) => <option key={g} value={g} style={{ background: '#0d1a0e', color: '#fff' }}>{g}</option>)}
              </select>
            </div>

            {totalIndicator(newCustomTotal)}
            {catWeightRows(
              { speed: newCustom.speed, strength: newCustom.strength, power: newCustom.power, agility: newCustom.agility, endurance: newCustom.endurance },
              (cat, val) => setNewCustom((prev) => ({ ...prev, [cat]: val }))
            )}

            {/* Test weights for multi-test categories (custom set) */}
            {Object.entries(weightableTests)
              .filter(([category, tests]) => category && category !== 'anthropometrics' && (tests?.length || 0) >= 1)
              .map(([category]) => {
                const tests = newCustomTestWeights[category] || {}
                const activeTests = Object.entries(tests)
                const testTotal = activeTests.reduce((s, [, d]) => s + Number(d.weight || 0), 0)
                const unusedTests = (weightableTests[category] || []).filter((t) => !tests[t.test_type])
                return (
                  <div key={`custom-${category}`} style={{ marginTop: '16px', padding: '14px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
                    <div style={{ fontSize: '11px', color: '#3fae52', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>
                      {CATEGORY_LABELS[category]} — Individual Test Weights
                    </div>
                    <div style={{ fontSize: '12px', color: testTotal === 100 ? '#3fae52' : '#f5a623', marginBottom: '10px' }}>
                      Total: {testTotal}% {testTotal !== 100 ? '— should equal 100%' : '✓'}
                    </div>
                    {activeTests.map(([testType, data]) => (
                      <div key={testType} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                        <div style={{ width: '150px', fontSize: '12px', color: 'rgba(255,255,255,0.8)' }}>{TEST_LABELS[testType] || (weightableTests[category] || []).find((t) => t.test_type === testType)?.display_name || testType}</div>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={data.weight || 0}
                          onChange={(e) => setNewCustomTestWeights((prev) => ({
                            ...prev,
                            [category]: {
                              ...(prev[category] || {}),
                              [testType]: { ...data, weight: Number(e.target.value) },
                            },
                          }))}
                          style={inputStyle}
                        />
                        <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>%</span>
                        <button
                          onClick={() => setNewCustomTestWeights((prev) => {
                            const updated = { ...(prev[category] || {}) }
                            delete updated[testType]
                            return { ...prev, [category]: updated }
                          })}
                          style={{ background: 'rgba(224,92,42,0.15)', border: '1px solid rgba(224,92,42,0.3)', borderRadius: '4px', color: '#e05c2a', padding: '3px 8px', fontSize: '11px', cursor: 'pointer' }}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    {unusedTests.length > 0 && (
                      <div style={{ marginTop: '8px', display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>Add:</span>
                        {unusedTests.map((t) => (
                          <button
                            key={t.test_type}
                            onClick={() => setNewCustomTestWeights((prev) => ({
                              ...prev,
                              [category]: {
                                ...(prev[category] || {}),
                                [t.test_type]: { weight: 0, is_active: true, id: null },
                              },
                            }))}
                            style={{ background: 'rgba(63,174,82,0.1)', border: '1px solid rgba(63,174,82,0.3)', borderRadius: '4px', color: '#3fae52', padding: '3px 8px', fontSize: '11px', cursor: 'pointer' }}
                          >
                            + {t.display_name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '16px' }}>
              <button onClick={handleAddCustom}
                disabled={!newCustom.sport || !newCustom.age_category || !newCustom.gender || newCustomTotal !== 100}
                style={{ background: 'rgba(63,174,82,0.15)', border: '1px solid rgba(63,174,82,0.4)', borderRadius: '8px', color: '#3fae52', padding: '8px 20px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', opacity: (!newCustom.sport || !newCustom.age_category || !newCustom.gender || newCustomTotal !== 100) ? 0.4 : 1 }}>
                Add Custom Weight Set
              </button>
              {weightsSaved === 'custom' && <span style={{ color: '#3fae52', fontSize: '13px' }}>✓ Custom set added</span>}
            </div>
          </div>

          {/* ACTIVE WEIGHTINGS TABLE */}
          <div style={{ marginBottom: '32px' }}>
            {sectionHeader('Active Weight Sets')}
            {weightsSaved === 'edited' && <div style={{ color: '#3fae52', fontSize: '13px', marginBottom: '12px' }}>✓ Weight set updated</div>}

            {[{ ...{ id: 'default-display', is_default: true, sport: 'default', age_category: 'default', gender: 'all', speed_weight: defaultCatWeights.speed / 100, strength_weight: defaultCatWeights.strength / 100, power_weight: defaultCatWeights.power / 100, agility_weight: defaultCatWeights.agility / 100, endurance_weight: defaultCatWeights.endurance / 100 } }, ...customWeightSets].map((row) => {
              const isDefault = row.is_default
              const isExpanded = expandedWeightSet === row.id
              const isEditing = editingWeightSet?.id === row.id || (isDefault && editingWeightSet?.is_default)
              const editTotal = editingWeightSet ? ['speed', 'strength', 'power', 'agility', 'endurance'].reduce((s, k) => s + Number(editingWeightSet[k] || 0), 0) : 0

              return (
                <div key={row.id} style={{ border: `1px solid ${isDefault ? 'rgba(63,174,82,0.3)' : 'rgba(255,255,255,0.08)'}`, borderRadius: '10px', marginBottom: '10px', overflow: 'hidden' }}>
                  
                  {/* Header row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: isDefault ? 'rgba(63,174,82,0.06)' : 'rgba(255,255,255,0.02)', cursor: 'pointer' }}
                    onClick={() => setExpandedWeightSet(isExpanded ? null : row.id)}>
                    <div style={{ flex: 1, fontWeight: '600', fontSize: '13px', color: isDefault ? '#3fae52' : 'white' }}>
                      {isDefault ? 'Default — All Athletes' : `${row.sport} · ${row.age_category} · ${row.gender}`}
                    </div>
                    {['speed', 'strength', 'power', 'agility', 'endurance'].map((cat) => (
                      <div key={cat} style={{ textAlign: 'center', minWidth: '56px' }}>
                        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{cat}</div>
                        <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.8)', fontWeight: '600' }}>
                          {Math.round((row[`${cat}_weight`] || 0) * 100)}%
                        </div>
                      </div>
                    ))}
                    <div style={{ display: 'flex', gap: '6px' }} onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => {
                        const rowForEdit = isDefault
                          ? { id: 'default-edit', is_default: true, sport: 'default', age_category: 'default', gender: 'all', speed_weight: defaultCatWeights.speed / 100, strength_weight: defaultCatWeights.strength / 100, power_weight: defaultCatWeights.power / 100, agility_weight: defaultCatWeights.agility / 100, endurance_weight: defaultCatWeights.endurance / 100 }
                          : row
                        handleEditWeightSet(rowForEdit)
                        setExpandedWeightSet(row.id)
                      }}
                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px', color: 'rgba(255,255,255,0.6)', padding: '3px 10px', fontSize: '11px', cursor: 'pointer' }}>
                        Edit
                      </button>
                      {!isDefault && (
                        <button onClick={() => handleDeleteCustom(row.id)}
                          style={{ background: 'rgba(224,92,42,0.12)', border: '1px solid rgba(224,92,42,0.25)', borderRadius: '4px', color: '#e05c2a', padding: '3px 10px', fontSize: '11px', cursor: 'pointer' }}>
                          Delete
                        </button>
                      )}
                    </div>
                    <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>{isExpanded ? '▲' : '▼'}</div>
                  </div>

                  {/* Expanded detail / edit */}
                  {isExpanded && (
                    <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.2)' }}>
                      {isEditing ? (
                        <>
                          {/* Edit mode — category weights */}
                          <div style={{ fontSize: '11px', color: '#3fae52', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px' }}>Category Weights</div>
                          <div style={{ fontSize: '12px', color: editTotal === 100 ? '#3fae52' : '#e05c2a', marginBottom: '10px', fontWeight: '600' }}>
                            Total: {editTotal}% {editTotal !== 100 ? '— must equal 100%' : '✓'}
                          </div>
                          {['speed', 'strength', 'power', 'agility', 'endurance'].map((cat) => (
                            <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                              <div style={{ width: '90px', fontSize: '12px', color: 'rgba(255,255,255,0.8)' }}>{CATEGORY_LABELS[cat]}</div>
                              <input type="number" min="0" max="100" value={editingWeightSet[cat]}
                                onChange={(e) => setEditingWeightSet((prev) => ({ ...prev, [cat]: Number(e.target.value) }))}
                                style={{ width: '56px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(63,174,82,0.3)', borderRadius: '6px', color: 'white', padding: '4px 8px', fontSize: '12px', textAlign: 'center' }} />
                              <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>%</span>
                              <div style={{ flex: 1, height: '3px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px' }}>
                                <div style={{ width: `${Math.min(editingWeightSet[cat], 100)}%`, height: '100%', background: '#3fae52', borderRadius: '2px' }} />
                              </div>
                            </div>
                          ))}

                          {/* Edit mode — test weights for multi-test categories */}
                          {Object.entries(weightableTests)
                            .filter(([, tests]) => (tests?.length || 0) >= 1)
                            .map(([category]) => {
                              const tests = editingWeightSetTests[category] || {}
                              const testTotal = Object.values(tests).reduce((s, d) => s + Number(d.weight), 0)
                              const unusedTests = (weightableTests[category] || []).filter((t) => !tests[t.test_type])
                              return (
                                <div key={category} style={{ marginTop: '14px', padding: '12px', background: 'rgba(63,174,82,0.04)', border: '1px solid rgba(63,174,82,0.12)', borderRadius: '8px' }}>
                                  <div style={{ fontSize: '11px', color: '#3fae52', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
                                    {CATEGORY_LABELS[category]} — Individual Test Weights
                                  </div>
                                  <div style={{ fontSize: '12px', color: testTotal === 100 ? '#3fae52' : '#f5a623', marginBottom: '8px' }}>
                                    Total: {testTotal}% {testTotal !== 100 ? '— should equal 100%' : '✓'}
                                  </div>
                                  {Object.entries(tests).map(([testType, data]) => (
                                    <div key={testType} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                      <div style={{ width: '150px', fontSize: '12px', color: 'rgba(255,255,255,0.8)' }}>{TEST_LABELS[testType] || (weightableTests[category] || []).find((t) => t.test_type === testType)?.display_name || testType}</div>
                                      <input type="number" min="0" max="100" value={data.weight}
                                        onChange={(e) => setEditingWeightSetTests((prev) => ({ ...prev, [category]: { ...prev[category], [testType]: { ...data, weight: Number(e.target.value) } } }))}
                                        style={{ width: '54px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(63,174,82,0.3)', borderRadius: '6px', color: 'white', padding: '4px 8px', fontSize: '12px', textAlign: 'center' }} />
                                      <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>%</span>
                                      <button onClick={() => setEditingWeightSetTests((prev) => { const u = { ...prev[category] }; delete u[testType]; return { ...prev, [category]: u } })}
                                        style={{ background: 'rgba(224,92,42,0.15)', border: '1px solid rgba(224,92,42,0.3)', borderRadius: '4px', color: '#e05c2a', padding: '3px 8px', fontSize: '11px', cursor: 'pointer' }}>
                                        Remove
                                      </button>
                                    </div>
                                  ))}
                                  {unusedTests.length > 0 && (
                                    <div style={{ marginTop: '6px', display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                                      <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>Add:</span>
                                      {unusedTests.map((t) => (
                                        <button key={t.test_type} onClick={() => setEditingWeightSetTests((prev) => ({
                                          ...prev,
                                          [category]: { ...prev[category], [t.test_type]: { weight: 0, is_active: true, id: null } }
                                        }))}
                                          style={{ background: 'rgba(63,174,82,0.08)', border: '1px solid rgba(63,174,82,0.25)', borderRadius: '4px', color: '#3fae52', padding: '3px 8px', fontSize: '11px', cursor: 'pointer' }}>
                                          + {t.display_name}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )
                            })}

                          <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                            <button onClick={handleSaveWeightSet} disabled={editTotal !== 100}
                              style={{ background: editTotal === 100 ? 'rgba(63,174,82,0.2)' : 'rgba(255,255,255,0.05)', border: `1px solid ${editTotal === 100 ? 'rgba(63,174,82,0.5)' : 'rgba(255,255,255,0.1)'}`, borderRadius: '7px', color: editTotal === 100 ? '#3fae52' : 'rgba(255,255,255,0.3)', padding: '8px 20px', fontSize: '13px', fontWeight: '600', cursor: editTotal === 100 ? 'pointer' : 'not-allowed' }}>
                              Save Changes
                            </button>
                            <button onClick={() => { setEditingWeightSet(null); setEditingWeightSetTests({}) }}
                              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '7px', color: 'rgba(255,255,255,0.5)', padding: '8px 16px', fontSize: '13px', cursor: 'pointer' }}>
                              Cancel
                            </button>
                          </div>
                        </>
                      ) : (
                        /* Read-only expanded view */
                        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                          {['speed', 'strength', 'power', 'agility', 'endurance'].map((cat) => {
                            const catPct = Math.round((row[`${cat}_weight`] || 0) * 100)
                            const setKey = row.is_default ? 'default|default|all' : `${row.sport}|${row.age_category}|${row.gender || 'all'}`
                            const catTests = row.is_default
                              ? defaultTestWeights[cat] || {}
                              : (activeTestWeights[setKey]?.[cat] || {})
                            const hasTests = ['strength', 'power'].includes(cat) && Object.keys(catTests).length > 0
                            return (
                              <div key={cat} style={{ minWidth: '120px' }}>
                                <div style={{ fontSize: '11px', color: '#3fae52', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>{CATEGORY_LABELS[cat]}</div>
                                <div style={{ fontSize: '16px', color: 'white', fontWeight: '700', marginBottom: hasTests ? '6px' : '0' }}>{catPct}%</div>
                                {hasTests && Object.entries(catTests).map(([testType, data]) => (
                                  <div key={testType} style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', marginBottom: '2px' }}>
                                    {TEST_LABELS[testType] || (weightableTests[cat] || []).find((t) => t.test_type === testType)?.display_name || testType}: {data.weight}%
                                  </div>
                                ))}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}

            {customWeightSets.length === 0 && (
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)', fontStyle: 'italic', padding: '8px 0' }}>
                No custom weight sets configured yet.
              </div>
            )}
          </div>

          {/* RECALCULATE */}
          <div style={{ borderTop: '1px solid rgba(63,174,82,0.15)', paddingTop: '24px' }}>
            {sectionHeader('Recalculate All Scores')}
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginBottom: '16px' }}>
              Applies current weights and recalculates composite scores for all athletes. AI insights will regenerate automatically.
            </p>
            {recalcStatus && (
              <div style={{ color: recalcStatus.startsWith('✓') ? '#3fae52' : '#f59e0b', fontSize: '13px', marginBottom: '12px' }}>{recalcStatus}</div>
            )}
            <button onClick={handleRecalcAll}
              style={{ background: 'rgba(63,174,82,0.1)', border: '1px solid rgba(63,174,82,0.3)', color: '#3fae52', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>
              Recalculate All Scores
            </button>
          </div>

        </>)}
      </div>
    )
  }

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

  const loadPrograms = async () => {
    setProgramsLoading(true)
    const { data, error } = await supabase
      .from('pfa_programs')
      .select('*')
      .order('created_at', { ascending: false })
    if (!error) setPrograms(data || [])
    setProgramsLoading(false)
  }

  const loadWeeks = async (programId) => {
    const { data } = await supabase
      .from('pfa_weeks')
      .select('*')
      .eq('program_id', programId)
      .order('week_number')
    setWeeks(data || [])
    setSelectedWeek(null)
    setDays([])
    setSelectedDay(null)
    setExercises([])
  }

  const loadDays = async (weekId) => {
    const { data } = await supabase
      .from('pfa_days')
      .select('*')
      .eq('week_id', weekId)
      .order('day_number')
    setDays(data || [])
    setSelectedDay(null)
    setExercises([])
  }

  const loadExercises = async (dayId) => {
    const { data } = await supabase
      .from('pfa_exercises')
      .select('*')
      .eq('day_id', dayId)
      .order('sort_order')
    setExercises(data || [])
  }

  const saveProgram = async () => {
    const payload = {
      ...programForm,
      tags: programForm.tags.split(',').map((t) => t.trim()).filter(Boolean),
      weeks_total: parseInt(programForm.weeks_total),
      days_per_week: parseInt(programForm.days_per_week),
      minutes_per_session: parseInt(programForm.minutes_per_session),
      slug: programForm.slug || programForm.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
    }
    if (selectedProgram) {
      await supabase.from('pfa_programs').update(payload).eq('id', selectedProgram.id)
    } else {
      await supabase.from('pfa_programs').insert(payload)
    }
    setShowProgramForm(false)
    setProgramForm({ title: '', slug: '', description: '', sport: 'all', tags: '', weeks_total: 8, days_per_week: 4, minutes_per_session: 60, level: 'all', pdf_url: '', thumbnail_url: '', published: false })
    loadPrograms()
  }

  const deleteProgram = async (id) => {
    if (!confirm('Delete this program and all its weeks, days, and exercises?')) return
    await supabase.from('pfa_programs').delete().eq('id', id)
    if (selectedProgram?.id === id) {
      setSelectedProgram(null)
      setWeeks([])
      setDays([])
      setExercises([])
    }
    loadPrograms()
  }

  const togglePublished = async (prog) => {
    await supabase.from('pfa_programs').update({ published: !prog.published }).eq('id', prog.id)
    loadPrograms()
  }

  const addWeek = async () => {
    if (!selectedProgram || !weekForm.week_number) return
    await supabase.from('pfa_weeks').insert({
      program_id: selectedProgram.id,
      week_number: parseInt(weekForm.week_number),
      focus: weekForm.focus,
    })
    setWeekForm({ week_number: '', focus: '' })
    loadWeeks(selectedProgram.id)
  }

  const deleteWeek = async (id) => {
    await supabase.from('pfa_weeks').delete().eq('id', id)
    if (selectedWeek?.id === id) {
      setSelectedWeek(null)
      setDays([])
      setSelectedDay(null)
      setExercises([])
    }
    loadWeeks(selectedProgram.id)
  }

  const addDay = async () => {
    if (!selectedWeek || !dayForm.day_number || !dayForm.label) return
    await supabase.from('pfa_days').insert({
      week_id: selectedWeek.id,
      day_number: parseInt(dayForm.day_number),
      label: dayForm.label,
      session_type: dayForm.session_type,
    })
    setDayForm({ day_number: '', label: '', session_type: 'Training' })
    loadDays(selectedWeek.id)
  }

  const deleteDay = async (id) => {
    await supabase.from('pfa_days').delete().eq('id', id)
    if (selectedDay?.id === id) {
      setSelectedDay(null)
      setExercises([])
    }
    loadDays(selectedWeek.id)
  }

  const addExercise = async () => {
    if (!selectedDay || !exerciseForm.name) return
    await supabase.from('pfa_exercises').insert({
      ...exerciseForm,
      day_id: selectedDay.id,
      sort_order: parseInt(exerciseForm.sort_order) || 0,
    })
    setExerciseForm({ name: '', sets_reps: '', coaching_notes: '', video_url: '', video_provider: 'youtube', sort_order: 0 })
    loadExercises(selectedDay.id)
  }

  const deleteExercise = async (id) => {
    await supabase.from('pfa_exercises').delete().eq('id', id)
    loadExercises(selectedDay.id)
  }

  const renderSection = () => {
    switch (activeSection) {
      case 'Dashboard':
        return renderDashboard()
      case 'Users':
        return renderUsers()
      case 'PFA Staff':
        return renderStaff()
      case 'staff':
        return renderStaff()
      case 'Teams':
        return renderTeams()
      case 'Coaches':
        return renderCoaches()
      case 'Athletes':
        return renderAthletes()
      case 'Settings':
        return renderSettings()
      case 'tests':
        return renderTests()
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
                  className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    activeSection === item
                      ? 'bg-[#1a2e1a] text-[#3fae52]'
                      : 'text-gray-400 hover:bg-[#1a2e1a] hover:text-white'
                  }`}
                >
                  {item}
                </button>
              )
            })}
            <button
              onClick={() => setActiveSection('scoreWeights')}
              className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeSection === 'scoreWeights'
                  ? 'bg-[#1a2e1a] text-[#3fae52]'
                  : 'text-gray-400 hover:bg-[#1a2e1a] hover:text-white'
              }`}
            >
              Score Weights
            </button>
            <button
              onClick={() => setActiveSection('tests')}
              className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeSection === 'tests'
                  ? 'bg-[#1a2e1a] text-[#3fae52]'
                  : 'text-gray-400 hover:bg-[#1a2e1a] hover:text-white'
              }`}
            >
              Tests
            </button>
            <a
              href="/session"
              className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeSection === 'sessions'
                  ? 'bg-[#1a2e1a] text-[#3fae52]'
                  : 'text-gray-400 hover:bg-[#1a2e1a] hover:text-white'
              }`}
            >
              Sessions
            </a>
            <button
              onClick={() => setActiveSection('programs')}
              className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeSection === 'programs'
                  ? 'bg-[#1a2e1a] text-[#3fae52]'
                  : 'text-gray-400 hover:bg-[#1a2e1a] hover:text-white'
              }`}
            >
              Programs
            </button>
          </div>
        </aside>

        <main className="space-y-6">
          <div className="bg-[#0d1a0e] border border-pfa-border rounded-xl p-4 flex items-center justify-between">
            <div className="text-lg font-semibold text-white">{SECTION_LABELS[activeSection] || activeSection}</div>
            <div className="text-sm text-white/60">{profile?.full_name || 'Rick Leger'} — {formatRole(profile?.role)}</div>
          </div>
          {renderSection()}
          {activeSection === 'scoreWeights' && renderScoreWeights()}
          {activeSection === 'programs' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">Programs</h2>
                <button
                  onClick={() => {
                    setSelectedProgram(null)
                    setProgramForm({ title: '', slug: '', description: '', sport: 'all', tags: '', weeks_total: 8, days_per_week: 4, minutes_per_session: 60, level: 'all', pdf_url: '', thumbnail_url: '', published: false })
                    setShowProgramForm(true)
                  }}
                  className="px-4 py-2 bg-[#3fae52] hover:bg-[#4ec962] text-black font-bold text-sm uppercase tracking-wide rounded"
                >
                  + New Program
                </button>
              </div>

              {showProgramForm && (
                <div className="bg-[#0d1a0d] border border-[#1a2e1a] rounded-lg p-6 mb-6">
                  <h3 className="text-white font-bold uppercase tracking-wide mb-4">
                    {selectedProgram ? 'Edit Program' : 'New Program'}
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-500 uppercase tracking-wide mb-1">Title *</label>
                      <input
                        className="w-full bg-[#0a120a] border border-[#1a2e1a] rounded px-3 py-2 text-white text-sm focus:border-[#3fae52] outline-none"
                        value={programForm.title}
                        onChange={(e) => setProgramForm((f) => ({
                          ...f,
                          title: e.target.value,
                          slug: e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
                        }))}
                        placeholder="Explosive Speed System"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 uppercase tracking-wide mb-1">Slug</label>
                      <input
                        className="w-full bg-[#0a120a] border border-[#1a2e1a] rounded px-3 py-2 text-white text-sm focus:border-[#3fae52] outline-none"
                        value={programForm.slug}
                        onChange={(e) => setProgramForm((f) => ({ ...f, slug: e.target.value }))}
                        placeholder="explosive-speed-system"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs text-gray-500 uppercase tracking-wide mb-1">Description</label>
                      <textarea
                        className="w-full bg-[#0a120a] border border-[#1a2e1a] rounded px-3 py-2 text-white text-sm focus:border-[#3fae52] outline-none h-20 resize-none"
                        value={programForm.description}
                        onChange={(e) => setProgramForm((f) => ({ ...f, description: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 uppercase tracking-wide mb-1">Sport</label>
                      <select
                        className="w-full bg-[#0a120a] border border-[#1a2e1a] rounded px-3 py-2 text-white text-sm focus:border-[#3fae52] outline-none"
                        value={programForm.sport}
                        onChange={(e) => setProgramForm((f) => ({ ...f, sport: e.target.value }))}
                      >
                        <option value="all">All Sports</option>
                        <option value="hockey">Hockey</option>
                        <option value="soccer">Soccer</option>
                        <option value="ringette">Ringette</option>
                        <option value="basketball">Basketball</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 uppercase tracking-wide mb-1">Level</label>
                      <select
                        className="w-full bg-[#0a120a] border border-[#1a2e1a] rounded px-3 py-2 text-white text-sm focus:border-[#3fae52] outline-none"
                        value={programForm.level}
                        onChange={(e) => setProgramForm((f) => ({ ...f, level: e.target.value }))}
                      >
                        <option value="all">All Levels</option>
                        <option value="beginner">Beginner</option>
                        <option value="intermediate">Intermediate</option>
                        <option value="advanced">Advanced</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 uppercase tracking-wide mb-1">Tags (comma-separated)</label>
                      <input
                        className="w-full bg-[#0a120a] border border-[#1a2e1a] rounded px-3 py-2 text-white text-sm focus:border-[#3fae52] outline-none"
                        value={programForm.tags}
                        onChange={(e) => setProgramForm((f) => ({ ...f, tags: e.target.value }))}
                        placeholder="speed, hockey, offseason"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 uppercase tracking-wide mb-1">Weeks Total</label>
                      <input
                        type="number"
                        className="w-full bg-[#0a120a] border border-[#1a2e1a] rounded px-3 py-2 text-white text-sm focus:border-[#3fae52] outline-none"
                        value={programForm.weeks_total}
                        onChange={(e) => setProgramForm((f) => ({ ...f, weeks_total: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 uppercase tracking-wide mb-1">Days / Week</label>
                      <input
                        type="number"
                        className="w-full bg-[#0a120a] border border-[#1a2e1a] rounded px-3 py-2 text-white text-sm focus:border-[#3fae52] outline-none"
                        value={programForm.days_per_week}
                        onChange={(e) => setProgramForm((f) => ({ ...f, days_per_week: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 uppercase tracking-wide mb-1">Minutes / Session</label>
                      <input
                        type="number"
                        className="w-full bg-[#0a120a] border border-[#1a2e1a] rounded px-3 py-2 text-white text-sm focus:border-[#3fae52] outline-none"
                        value={programForm.minutes_per_session}
                        onChange={(e) => setProgramForm((f) => ({ ...f, minutes_per_session: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 uppercase tracking-wide mb-1">PDF URL</label>
                      <input
                        className="w-full bg-[#0a120a] border border-[#1a2e1a] rounded px-3 py-2 text-white text-sm focus:border-[#3fae52] outline-none"
                        value={programForm.pdf_url}
                        onChange={(e) => setProgramForm((f) => ({ ...f, pdf_url: e.target.value }))}
                        placeholder="https://..."
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 uppercase tracking-wide mb-1">Thumbnail URL</label>
                      <input
                        className="w-full bg-[#0a120a] border border-[#1a2e1a] rounded px-3 py-2 text-white text-sm focus:border-[#3fae52] outline-none"
                        value={programForm.thumbnail_url}
                        onChange={(e) => setProgramForm((f) => ({ ...f, thumbnail_url: e.target.value }))}
                        placeholder="https://..."
                      />
                    </div>
                    <div className="col-span-2 flex items-center gap-3">
                      <input
                        type="checkbox"
                        id="prog-published"
                        checked={programForm.published}
                        onChange={(e) => setProgramForm((f) => ({ ...f, published: e.target.checked }))}
                        className="w-4 h-4 accent-[#3fae52]"
                      />
                      <label htmlFor="prog-published" className="text-sm text-gray-400">
                        Published — visible to subscribers
                      </label>
                    </div>
                  </div>
                  <div className="flex gap-3 mt-5">
                    <button
                      onClick={saveProgram}
                      className="px-5 py-2 bg-[#3fae52] hover:bg-[#4ec962] text-black font-bold text-sm uppercase tracking-wide rounded"
                    >
                      Save Program
                    </button>
                    <button
                      onClick={() => setShowProgramForm(false)}
                      className="px-5 py-2 border border-[#1a2e1a] text-gray-400 hover:text-white text-sm uppercase tracking-wide rounded"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {programsLoading ? (
                <p className="text-gray-500 text-sm">Loading...</p>
              ) : (
                <div className="bg-[#0d1a0d] border border-[#1a2e1a] rounded-lg overflow-hidden mb-6">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#1a2e1a]">
                        <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase tracking-wide">Title</th>
                        <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase tracking-wide">Sport</th>
                        <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase tracking-wide">Structure</th>
                        <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase tracking-wide">Status</th>
                        <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase tracking-wide">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {programs.map((prog) => (
                        <tr
                          key={prog.id}
                          className={`border-b border-[#1a2e1a] cursor-pointer transition-colors ${
                            selectedProgram?.id === prog.id ? 'bg-[#0a1a0a]' : 'hover:bg-[#0a120a]'
                          }`}
                        >
                          <td
                            className="px-4 py-3 text-white font-medium"
                            onClick={() => { setSelectedProgram(prog); loadWeeks(prog.id) }}
                          >
                            {prog.title}
                            {selectedProgram?.id === prog.id && (
                              <span className="ml-2 text-xs text-[#3fae52]">▶ editing</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-400 capitalize">{prog.sport}</td>
                          <td className="px-4 py-3 text-gray-400">{prog.weeks_total}w · {prog.days_per_week}d/wk · {prog.minutes_per_session}min</td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => togglePublished(prog)}
                              className={`text-xs font-bold uppercase tracking-wide px-2 py-1 rounded ${
                                prog.published
                                  ? 'bg-[#3fae52]/20 text-[#3fae52]'
                                  : 'bg-gray-800 text-gray-500'
                              }`}
                            >
                              {prog.published ? 'Live' : 'Draft'}
                            </button>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-3">
                              <button
                                onClick={() => {
                                  setSelectedProgram(prog)
                                  setProgramForm({ ...prog, tags: (prog.tags || []).join(', ') })
                                  setShowProgramForm(true)
                                }}
                                className="text-xs text-blue-400 hover:text-blue-300 uppercase tracking-wide"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => deleteProgram(prog.id)}
                                className="text-xs text-red-500 hover:text-red-400 uppercase tracking-wide"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {programs.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-4 py-10 text-center text-gray-600 text-sm">
                            No programs yet. Click + New Program to create your first one.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {selectedProgram && (
                <div>
                  <h3 className="text-white font-bold uppercase tracking-wide text-sm mb-3">
                    Building: {selectedProgram.title}
                  </h3>
                  <div className="grid grid-cols-3 gap-4">

                    <div className="bg-[#0d1a0d] border border-[#1a2e1a] rounded-lg p-4">
                      <h4 className="text-xs text-gray-500 uppercase tracking-wide font-bold mb-3">Weeks</h4>
                      <div className="space-y-2 mb-4">
                        {weeks.map((w) => (
                          <div
                            key={w.id}
                            onClick={() => { setSelectedWeek(w); loadDays(w.id) }}
                            className={`flex items-center justify-between px-3 py-2 rounded cursor-pointer text-sm transition-colors ${
                              selectedWeek?.id === w.id
                                ? 'bg-[#3fae52]/20 border border-[#3fae52]/50 text-white'
                                : 'bg-[#0a120a] text-gray-400 hover:text-white'
                            }`}
                          >
                            <span>Week {w.week_number}{w.focus ? ` — ${w.focus}` : ''}</span>
                            <button
                              onClick={(e) => { e.stopPropagation(); deleteWeek(w.id) }}
                              className="text-red-600 hover:text-red-400 text-xs ml-2 leading-none"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                        {weeks.length === 0 && (
                          <p className="text-xs text-gray-600">No weeks yet.</p>
                        )}
                      </div>
                      <div className="space-y-2 pt-3 border-t border-[#1a2e1a]">
                        <input
                          className="w-full bg-[#0a120a] border border-[#1a2e1a] rounded px-2 py-1.5 text-white text-xs focus:border-[#3fae52] outline-none"
                          placeholder="Week number"
                          value={weekForm.week_number}
                          onChange={(e) => setWeekForm((f) => ({ ...f, week_number: e.target.value }))}
                        />
                        <input
                          className="w-full bg-[#0a120a] border border-[#1a2e1a] rounded px-2 py-1.5 text-white text-xs focus:border-[#3fae52] outline-none"
                          placeholder="Focus (e.g. Acceleration)"
                          value={weekForm.focus}
                          onChange={(e) => setWeekForm((f) => ({ ...f, focus: e.target.value }))}
                        />
                        <button
                          onClick={addWeek}
                          className="w-full py-1.5 bg-[#3fae52]/20 hover:bg-[#3fae52]/30 text-[#3fae52] text-xs uppercase tracking-wide rounded font-bold"
                        >
                          + Add Week
                        </button>
                      </div>
                    </div>

                    <div className="bg-[#0d1a0d] border border-[#1a2e1a] rounded-lg p-4">
                      <h4 className="text-xs text-gray-500 uppercase tracking-wide font-bold mb-3">
                        {selectedWeek ? `Days — Week ${selectedWeek.week_number}` : 'Select a week first'}
                      </h4>
                      <div className="space-y-2 mb-4">
                        {days.map((d) => (
                          <div
                            key={d.id}
                            onClick={() => { setSelectedDay(d); loadExercises(d.id) }}
                            className={`flex items-center justify-between px-3 py-2 rounded cursor-pointer text-sm transition-colors ${
                              selectedDay?.id === d.id
                                ? 'bg-[#3fae52]/20 border border-[#3fae52]/50 text-white'
                                : 'bg-[#0a120a] text-gray-400 hover:text-white'
                            }`}
                          >
                            <span>Day {d.day_number} — {d.label}</span>
                            <button
                              onClick={(e) => { e.stopPropagation(); deleteDay(d.id) }}
                              className="text-red-600 hover:text-red-400 text-xs ml-2 leading-none"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                        {selectedWeek && days.length === 0 && (
                          <p className="text-xs text-gray-600">No days yet.</p>
                        )}
                      </div>
                      {selectedWeek && (
                        <div className="space-y-2 pt-3 border-t border-[#1a2e1a]">
                          <input
                            className="w-full bg-[#0a120a] border border-[#1a2e1a] rounded px-2 py-1.5 text-white text-xs focus:border-[#3fae52] outline-none"
                            placeholder="Day number"
                            value={dayForm.day_number}
                            onChange={(e) => setDayForm((f) => ({ ...f, day_number: e.target.value }))}
                          />
                          <input
                            className="w-full bg-[#0a120a] border border-[#1a2e1a] rounded px-2 py-1.5 text-white text-xs focus:border-[#3fae52] outline-none"
                            placeholder="Label (e.g. Speed & Acceleration)"
                            value={dayForm.label}
                            onChange={(e) => setDayForm((f) => ({ ...f, label: e.target.value }))}
                          />
                          <select
                            className="w-full bg-[#0a120a] border border-[#1a2e1a] rounded px-2 py-1.5 text-white text-xs focus:border-[#3fae52] outline-none"
                            value={dayForm.session_type}
                            onChange={(e) => setDayForm((f) => ({ ...f, session_type: e.target.value }))}
                          >
                            <option>Training</option>
                            <option>Speed</option>
                            <option>Strength</option>
                            <option>Power</option>
                            <option>Recovery</option>
                            <option>Rest</option>
                          </select>
                          <button
                            onClick={addDay}
                            className="w-full py-1.5 bg-[#3fae52]/20 hover:bg-[#3fae52]/30 text-[#3fae52] text-xs uppercase tracking-wide rounded font-bold"
                          >
                            + Add Day
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="bg-[#0d1a0d] border border-[#1a2e1a] rounded-lg p-4">
                      <h4 className="text-xs text-gray-500 uppercase tracking-wide font-bold mb-3">
                        {selectedDay ? `Exercises — ${selectedDay.label}` : 'Select a day first'}
                      </h4>
                      <div className="space-y-2 mb-4">
                        {exercises.map((ex) => (
                          <div key={ex.id} className="bg-[#0a120a] rounded px-3 py-2 text-xs space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-white font-semibold">{ex.name}</span>
                              <button
                                onClick={() => deleteExercise(ex.id)}
                                className="text-red-600 hover:text-red-400 text-xs leading-none"
                              >
                                ✕
                              </button>
                            </div>
                            {ex.sets_reps && <div className="text-gray-500">{ex.sets_reps}</div>}
                            {ex.coaching_notes && <div className="text-gray-600 italic">{ex.coaching_notes}</div>}
                            {ex.video_url && (
                              <div className="text-[#3fae52]/60 truncate">{ex.video_provider}: {ex.video_url}</div>
                            )}
                          </div>
                        ))}
                        {selectedDay && exercises.length === 0 && (
                          <p className="text-xs text-gray-600">No exercises yet.</p>
                        )}
                      </div>
                      {selectedDay && (
                        <div className="space-y-2 pt-3 border-t border-[#1a2e1a]">
                          <input
                            className="w-full bg-[#0a120a] border border-[#1a2e1a] rounded px-2 py-1.5 text-white text-xs focus:border-[#3fae52] outline-none"
                            placeholder="Exercise name *"
                            value={exerciseForm.name}
                            onChange={(e) => setExerciseForm((f) => ({ ...f, name: e.target.value }))}
                          />
                          <input
                            className="w-full bg-[#0a120a] border border-[#1a2e1a] rounded px-2 py-1.5 text-white text-xs focus:border-[#3fae52] outline-none"
                            placeholder="Sets / reps (e.g. 4 × 6 · 90s rest)"
                            value={exerciseForm.sets_reps}
                            onChange={(e) => setExerciseForm((f) => ({ ...f, sets_reps: e.target.value }))}
                          />
                          <textarea
                            className="w-full bg-[#0a120a] border border-[#1a2e1a] rounded px-2 py-1.5 text-white text-xs focus:border-[#3fae52] outline-none h-14 resize-none"
                            placeholder="Coaching notes"
                            value={exerciseForm.coaching_notes}
                            onChange={(e) => setExerciseForm((f) => ({ ...f, coaching_notes: e.target.value }))}
                          />
                          <input
                            className="w-full bg-[#0a120a] border border-[#1a2e1a] rounded px-2 py-1.5 text-white text-xs focus:border-[#3fae52] outline-none"
                            placeholder="Video URL (YouTube or Vimeo)"
                            value={exerciseForm.video_url}
                            onChange={(e) => setExerciseForm((f) => ({ ...f, video_url: e.target.value }))}
                          />
                          <select
                            className="w-full bg-[#0a120a] border border-[#1a2e1a] rounded px-2 py-1.5 text-white text-xs focus:border-[#3fae52] outline-none"
                            value={exerciseForm.video_provider}
                            onChange={(e) => setExerciseForm((f) => ({ ...f, video_provider: e.target.value }))}
                          >
                            <option value="youtube">YouTube</option>
                            <option value="vimeo">Vimeo</option>
                          </select>
                          <input
                            type="number"
                            className="w-full bg-[#0a120a] border border-[#1a2e1a] rounded px-2 py-1.5 text-white text-xs focus:border-[#3fae52] outline-none"
                            placeholder="Sort order (0, 1, 2...)"
                            value={exerciseForm.sort_order}
                            onChange={(e) => setExerciseForm((f) => ({ ...f, sort_order: e.target.value }))}
                          />
                          <button
                            onClick={addExercise}
                            className="w-full py-1.5 bg-[#3fae52]/20 hover:bg-[#3fae52]/30 text-[#3fae52] text-xs uppercase tracking-wide rounded font-bold"
                          >
                            + Add Exercise
                          </button>
                        </div>
                      )}
                    </div>

                  </div>
                </div>
              )}
            </div>
          )}
          {cardModalAthlete && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.85)',
                zIndex: 9999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <button
                onClick={() => setCardModalAthlete(null)}
                style={{
                  position: 'absolute',
                  top: '16px',
                  right: '16px',
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: 'white',
                  fontSize: '18px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                ×
              </button>

              <div
                style={{
                  maxWidth: '420px',
                  width: '90vw',
                  maxHeight: '85vh',
                  overflowY: 'auto',
                  borderRadius: '14px',
                  background: 'linear-gradient(160deg, #0d1a0e 0%, #0a0f0a 60%)',
                  border: '2px solid rgba(63,174,82,0.4)',
                  padding: '16px',
                  position: 'relative',
                  boxShadow: '0 20px 80px rgba(0,0,0,0.6)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ color: '#3fae52', fontWeight: 800, letterSpacing: '0.08em' }}>PFA</div>
                  <div style={{ color: 'white', fontWeight: 700 }}>{cardModalAthlete?.full_name || 'Athlete'}</div>
                </div>
                <div style={{ borderBottom: '1px solid rgba(63,174,82,0.25)', margin: '8px 0' }} />

                {(() => {
                  const scoreRows = [
                    { label: 'Overall', key: 'overall_score' },
                    { label: 'Speed', key: 'speed_score' },
                    { label: 'Power', key: 'power_score' },
                    { label: 'Strength', key: 'strength_score' },
                    { label: 'Agility', key: 'agility_score' },
                    { label: 'Endurance', key: 'endurance_score' },
                  ]
                  const latestTestDate = (cardModalResults || []).reduce((latest, r) => {
                    return !latest || r.date_tested > latest ? r.date_tested : latest
                  }, null)
                  const scoreSeasonYear = latestTestDate ? getSeasonYear(latestTestDate) : null

                  return (
                    <div style={{ padding: '12px 0' }}>
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 80px 80px',
                          padding: '6px 0',
                          borderBottom: '1px solid rgba(63,174,82,0.3)',
                          marginBottom: '4px',
                        }}
                      >
                        <div style={{ color: 'rgba(63,174,82,0.6)', fontSize: '9px', fontWeight: '700', letterSpacing: '0.1em' }}>STANDARDIZED SCORES</div>
                        <div style={{ color: 'rgba(63,174,82,0.6)', fontSize: '9px', fontWeight: '700', textAlign: 'center' }}>2025</div>
                        <div style={{ color: '#3fae52', fontSize: '9px', fontWeight: '700', textAlign: 'center' }}>2026</div>
                      </div>
                      {scoreRows.map((row, idx) => {
                        const val = cardModalScores?.[row.key]
                        const score2025 = scoreSeasonYear === 2025 && val != null ? Math.round(val) : null
                        const score2026 = scoreSeasonYear === 2026 && val != null ? Math.round(val) : null
                        return (
                          <div
                            key={row.key}
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '1fr 80px 80px',
                              padding: '5px 0',
                              borderBottom: idx < scoreRows.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                            }}
                          >
                            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '10px', fontWeight: '600' }}>{row.label}</div>
                            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px', textAlign: 'center' }}>{score2025 !== null ? score2025 : '—'}</div>
                            <div
                              style={{
                                color: score2026 !== null ? '#ffffff' : 'rgba(255,255,255,0.25)',
                                fontSize: '10px',
                                fontWeight: score2026 !== null ? '700' : '400',
                                textAlign: 'center',
                              }}
                            >
                              {score2026 !== null ? score2026 : '—'}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                })()}

                {(() => {
                  const bySeason = {}
                  for (const m of cardModalMeasurements || []) {
                    const season = getSeasonYear(m.measurement_date)
                    if (!bySeason[season]) bySeason[season] = m
                  }
                  const fmt = (val, suffix) => (val != null ? `${val}${suffix}` : '—')
                  const heightToFtIn = (inches) => {
                    if (!inches) return '—'
                    const ft = Math.floor(inches / 12)
                    const ins = Math.round(inches % 12)
                    return `${ft}'${ins}"`
                  }
                  const rows = [
                    { label: 'Height', season2025: bySeason[2025] ? heightToFtIn(bySeason[2025].height) : '—', season2026: bySeason[2026] ? heightToFtIn(bySeason[2026].height) : '—' },
                    { label: 'Weight', season2025: bySeason[2025] ? fmt(bySeason[2025].weight, ' lbs') : '—', season2026: bySeason[2026] ? fmt(bySeason[2026].weight, ' lbs') : '—' },
                    { label: 'Body Fat', season2025: bySeason[2025]?.body_fat_percentage != null ? `${bySeason[2025].body_fat_percentage}%` : '—', season2026: bySeason[2026]?.body_fat_percentage != null ? `${bySeason[2026].body_fat_percentage}%` : '—' },
                  ]

                  return (
                    <div style={{ padding: '4px 0 12px' }}>
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 80px 80px',
                          padding: '6px 0',
                          borderBottom: '1px solid rgba(63,174,82,0.3)',
                          marginBottom: '4px',
                        }}
                      >
                        <div style={{ color: 'rgba(63,174,82,0.6)', fontSize: '9px', fontWeight: '700', letterSpacing: '0.1em' }}>MEASUREMENTS</div>
                        <div style={{ color: 'rgba(63,174,82,0.6)', fontSize: '9px', fontWeight: '700', textAlign: 'center' }}>2025</div>
                        <div style={{ color: '#3fae52', fontSize: '9px', fontWeight: '700', textAlign: 'center' }}>2026</div>
                      </div>
                      {rows.map((row, idx) => (
                        <div
                          key={row.label}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 80px 80px',
                            padding: '5px 0',
                            borderBottom: idx < rows.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                          }}
                        >
                          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '10px', fontWeight: '600' }}>{row.label}</div>
                          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px', textAlign: 'center' }}>{row.season2025}</div>
                          <div
                            style={{
                              color: row.season2026 !== '—' ? '#ffffff' : 'rgba(255,255,255,0.25)',
                              fontSize: '10px',
                              fontWeight: row.season2026 !== '—' ? '700' : '400',
                              textAlign: 'center',
                            }}
                          >
                            {row.season2026}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                })()}

                {(() => {
                  const seasonStats = buildCardModalSeasonStats(cardModalResults)
                  return (
                    <div style={{ padding: '0 0 8px' }}>
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 70px 70px',
                          padding: '6px 0',
                          borderBottom: '1px solid rgba(63,174,82,0.3)',
                          marginBottom: '4px',
                        }}
                      >
                        <div style={{ color: 'rgba(63,174,82,0.6)', fontSize: '9px', fontWeight: '700', letterSpacing: '0.1em', textTransform: 'uppercase' }}>TEST</div>
                        <div style={{ color: 'rgba(63,174,82,0.6)', fontSize: '9px', fontWeight: '700', textAlign: 'center' }}>2025</div>
                        <div style={{ color: '#3fae52', fontSize: '9px', fontWeight: '700', textAlign: 'center' }}>2026</div>
                      </div>
                      {seasonStats.map((stat, i) => (
                        <div
                          key={stat.testType}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 70px 70px',
                            padding: '5px 0',
                            borderBottom: i < seasonStats.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                            opacity: stat.hasAnyData ? 1 : 0.3,
                          }}
                        >
                          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '10px', fontWeight: '600' }}>{stat.label}</div>
                          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px', textAlign: 'center' }}>{stat.season2025}</div>
                          <div
                            style={{
                              color: stat.season2026 !== '—' ? '#ffffff' : 'rgba(255,255,255,0.25)',
                              fontSize: '10px',
                              fontWeight: stat.season2026 !== '—' ? '700' : '400',
                              textAlign: 'center',
                            }}
                          >
                            {stat.season2026}
                          </div>
                        </div>
                      ))}
                      <div
                        style={{
                          marginTop: '8px',
                          paddingTop: '8px',
                          borderTop: '1px solid rgba(255,255,255,0.06)',
                          color: 'rgba(255,255,255,0.3)',
                          fontSize: '8px',
                          lineHeight: '1.4',
                          fontStyle: 'italic',
                        }}
                      >
                        * Squat, Bench Press, and Trap Bar Deadlift values represent an estimated one-repetition maximum (1RM), calculated from the load and repetitions completed during testing using a validated predictive formula.
                      </div>
                    </div>
                  )
                })()}
              </div>
            </div>
          )}
        </main>
      </div>
    </DashboardLayout>
  )
}

export default Admin
