import React, { useEffect, useMemo, useRef, useState } from 'react'
import DashboardLayout from '../components/layout/DashboardLayout'
import useAuth from '../hooks/useAuth'
import { TEST_CATEGORIES, getTest } from '../constants/tests'
import { getAllAthletes, getAthletesByTeamJunction } from '../services/athletes'
import { getActiveSessionsToday, createSession, endSession, getAllTeams } from '../services/teams'
import { getResultsForSession, saveTestResult, getResultsForAthlete, getBaselineResults } from '../services/testResults'
import { supabase } from '../services/supabase'

const TEST_UNITS = {
  '10m_sprint': 's',
  '30m_sprint': 's',
  'pro_agility_shuttle': 's',
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

const STRENGTH_LOAD_TESTS = ['squat', 'bench_press', 'trap_bar_deadlift']

const calcE1RM = (load, reps) => {
  if (!load || !reps || reps === 1) return load
  return Math.round(load * (1 + reps / 30))
}

const calcRelativeStrength = (e1rm, bodyweightLbs) => {
  if (!e1rm || !bodyweightLbs) return null
  return Math.round((e1rm / bodyweightLbs) * 100) / 100
}

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
  triple_jump: 'Triple Jump',
  plank: 'Plank',
}

const CATEGORY_COLORS = {
  SPEED: '#3fae52',
  POWER: '#f59e0b',
  STRENGTH: '#ef4444',
  AGILITY: '#8b5cf6',
  ENDURANCE: '#06b6d4',
  ANTHROPOMETRICS: '#ec4899',
}

const LOWER_IS_BETTER = ['10m_sprint', '30m_sprint', 'pro_agility_shuttle']

const Session = () => {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [teams, setTeams] = useState([])
  const [athletes, setAthletes] = useState([])
  const [activeSessions, setActiveSessions] = useState([])

  const [selectedTeamId, setSelectedTeamId] = useState('')
  const [selectedAthleteIds, setSelectedAthleteIds] = useState([])
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedTestId, setSelectedTestId] = useState('')
  const [location, setLocation] = useState('')

  const [sessionId, setSessionId] = useState(null)
  const [sessionInfo, setSessionInfo] = useState(null)
  const [participants, setParticipants] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [results, setResults] = useState([])
  const [inputValue, setInputValue] = useState('')
  const [anthropoForm, setAnthropoForm] = useState({ weight: '', bodyFat: '', height: '' })
  const [startError, setStartError] = useState('')
  const [starting, setStarting] = useState(false)
  const [sessionHistory, setSessionHistory] = useState([])
  const [expandedDates, setExpandedDates] = useState({})
  const [historySearch, setHistorySearch] = useState('')
  const [historyCategory, setHistoryCategory] = useState('All')
  const [checkedInToday, setCheckedInToday] = useState(false)
  const [loadValue, setLoadValue] = useState('')
  const [repsValue, setRepsValue] = useState('')
  const [latestBodyweight, setLatestBodyweight] = useState(null)
  const [trialValues, setTrialValues] = useState(['', '', ''])
  const [trialLoads, setTrialLoads] = useState(['', '', ''])
  const [trialReps, setTrialReps] = useState(['', '', ''])
  const [selectedTrial, setSelectedTrial] = useState(0)
  const [activeTab, setActiveTab] = useState('session')
  const [saveConfirm, setSaveConfirm] = useState('')
  const [athleteMode, setAthleteMode] = useState('team')
  const [athleteSearch, setAthleteSearch] = useState('')
  const [availableTests, setAvailableTests] = useState({})
  const [testMeta, setTestMeta] = useState({})
  const inputRef = useRef(null)

  const currentAthlete = participants[currentIndex] || null
  const currentTest = useMemo(() => testMeta[selectedTestId] || getTest(selectedTestId), [selectedTestId, testMeta])
  const completedCount = useMemo(
    () => results.filter((r) => r.session_id === sessionId && r.test_type === selectedTestId).length,
    [results, sessionId, selectedTestId]
  )

  const inputStyle = {
    width: '100%',
    background: '#0a0f0a',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '10px',
    padding: '10px 12px',
    color: '#fff',
    fontSize: '16px',
  }

  useEffect(() => {
    const loadSetup = async () => {
      try {
        const [teamsData, athletesData, sessionsData] = await Promise.all([
          getAllTeams(),
          getAllAthletes(),
          getActiveSessionsToday(),
        ])
        setTeams(teamsData || [])
        setAthletes(athletesData || [])
        setActiveSessions(sessionsData || [])
      } catch (err) {
        console.error('Failed to load setup data', err)
      }
      setLoading(false)
    }
    loadSetup()
  }, [])

  useEffect(() => {
    loadHistory()
  }, [])

  useEffect(() => {
    const loadTests = async () => {
      const { data, error } = await supabase
        .from('pfa_tests')
        .select('test_type, display_name, category, unit, lower_is_better, is_load_based')
        .eq('is_active', true)
        .order('category')
        .order('display_name')
      if (!error && data) {
        const grouped = data.reduce((acc, test) => {
          if (!acc[test.category]) acc[test.category] = []
          acc[test.category].push(test)
          return acc
        }, {})
        const meta = data.reduce((acc, test) => {
          acc[test.test_type] = test
          return acc
        }, {})
        setAvailableTests(grouped)
        setTestMeta(meta)
      }
    }
    loadTests()
  }, [])

  useEffect(() => {
    const fetchBodyweight = async () => {
      if (!currentAthlete) {
        setLatestBodyweight(null)
        return
      }
      try {
        const { data: bwData } = await supabase
          .from('pfa_body_measurements')
          .select('weight')
          .eq('athlete_id', currentAthlete.id)
          .order('measurement_date', { ascending: false })
          .limit(1)
        setLatestBodyweight(bwData?.[0]?.weight || null)
      } catch (err) {
        console.error('Failed to fetch bodyweight', err)
        setLatestBodyweight(null)
      }
    }
    fetchBodyweight()
  }, [currentAthlete])

  useEffect(() => {
    if (!sessionId) return
    const channel = supabase
      .channel(`session-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'pfa_test_results',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          setResults((prev) => (prev.some((r) => r.id === payload.new.id) ? prev : [...prev, payload.new]))
        }
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [sessionId])

  useEffect(() => {
    if (currentAthlete && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [currentAthlete])

  const isLoadBasedTest = (id) => testMeta[id]?.is_load_based ?? STRENGTH_LOAD_TESTS.includes(id)
  const isLowerBetter = (id) => testMeta[id]?.lower_is_better ?? LOWER_IS_BETTER.includes(id)
  const getTestLabel = (id) => testMeta[id]?.display_name || TEST_LABELS[id] || id

  const refreshActiveSessions = async () => {
    try {
      const sessionsData = await getActiveSessionsToday()
      setActiveSessions(sessionsData || [])
    } catch (err) {
      console.error('Failed to refresh sessions', err)
    }
  }

  const loadHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('pfa_test_results')
        .select('id, test_type, value, date_tested, category, load_value, reps, relative_strength, athlete_id, profiles(full_name, sport, position)')
        .order('date_tested', { ascending: false })
      if (error) throw error
      setSessionHistory(data || [])
    } catch (err) {
      console.error('Failed to load test history', err)
    }
  }

  const handleStartSession = async () => {
    if (!selectedCategory) {
      setStartError('Select a test category to continue.')
      return
    }
    if (!selectedTestId) {
      setStartError('Select a specific test to continue.')
      return
    }
    if (!selectedTeamId && selectedAthleteIds.length === 0) {
      setStartError('Select at least one athlete to start the session.')
      return
    }
    try {
      setStartError('')
      setStarting(true)
      let roster = []
      if (selectedTeamId) {
        roster = await getAthletesByTeamJunction(selectedTeamId)
      } else {
        roster = athletes.filter((a) => selectedAthleteIds.includes(a.id))
      }
      if (!roster.length) {
        setStartError('No athletes found for this selection.')
        setStarting(false)
        return
      }

      const newSession = await createSession({
        team_id: selectedTeamId || null,
        test_category: selectedCategory,
        test_type: selectedTestId,
        location: location || null,
        status: 'in_progress',
        session_date: new Date().toISOString().split('T')[0],
        conducted_by: user?.id || null,
      })

      setSessionId(newSession.id)
      setSessionInfo(newSession)
      setParticipants(roster)
      setCurrentIndex(0)
      setResults([])
      setInputValue('')
      refreshActiveSessions()
    } catch (err) {
      console.error('Failed to start session', err)
      setStartError('Failed to start session. Please try again.')
    } finally {
      setStarting(false)
    }
  }

  const handleJoinSession = async (session) => {
    try {
      let roster = []
      if (session.team_id) {
        roster = await getAthletesByTeamJunction(session.team_id)
      } else {
        roster = athletes
      }
      setSelectedCategory(session.test_category)
      setSelectedTestId(session.test_type)
      setSessionId(session.id)
      setSessionInfo(session)
      setParticipants(roster)
      setCurrentIndex(0)
      const existingResults = await getResultsForSession(session.id)
      setResults(existingResults || [])
      setInputValue('')
    } catch (err) {
      console.error('Failed to join session', err)
    }
  }

  const handleEndSession = async () => {
    if (!sessionId) return
    try {
      await endSession(sessionId)
      setSessionId(null)
      setSessionInfo(null)
      setParticipants([])
      setCurrentIndex(0)
      setResults([])
      setInputValue('')
      refreshActiveSessions()
    } catch (err) {
      console.error('Failed to end session', err)
    }
  }

  const handleSaveResult = async (flagged = false) => {
    if (!currentAthlete || !sessionId || !selectedTestId) return
    try {
      if (selectedCategory === 'anthropometrics') {
        await supabase.from('pfa_body_measurements').insert({
          athlete_id: currentAthlete.id,
          measurement_date: new Date().toISOString().split('T')[0],
          weight: parseFloat(anthropoForm.weight) || null,
          body_fat_percentage: parseFloat(anthropoForm.bodyFat) || null,
          height: parseFloat(anthropoForm.height) || null,
        })
        setAnthropoForm({ weight: '', bodyFat: '', height: '' })
        setSaveConfirm('✓ Measurements saved')
        setTimeout(() => { setSaveConfirm(''); setCurrentIndex(idx => Math.min(idx + 1, participants.length)) }, 1500)
        return
      }

      if (!currentTest) return

      const isLoadBased = isLoadBasedTest(selectedTestId)
      const isLower = isLowerBetter(selectedTestId)

      // Build trial data
      let trials = []
      if (isLoadBased) {
        for (let i = 0; i < 3; i++) {
          const load = parseFloat(trialLoads[i])
          const reps = parseInt(trialReps[i])
          if (load && reps) {
            const e1rm = calcE1RM(load, reps)
            trials.push({ index: i, load, reps, e1rm, value: e1rm })
          }
        }
      } else {
        for (let i = 0; i < 3; i++) {
          const val = parseFloat(trialValues[i])
          if (!isNaN(val) && trialValues[i] !== '') {
            trials.push({ index: i, value: val })
          }
        }
      }

      if (trials.length === 0) return

      // Find best trial
      const bestTrial = trials.reduce((best, t) => {
        if (!best) return t
        if (isLower) return t.value < best.value ? t : best
        return t.value > best.value ? t : best
      }, null)

      // Use selectedTrial override if manually selected
      const finalTrial = trials[selectedTrial] || bestTrial

      // Save to session_results first
      const { data: stationData } = await supabase
        .from('session_stations')
        .select('id')
        .eq('session_id', sessionId)
        .eq('test_type', selectedTestId)
        .limit(1)
        .single()

      await supabase.from('session_results').insert({
        session_id: sessionId,
        station_id: stationData?.id || null,
        athlete_id: currentAthlete.id,
        test_type: selectedTestId,
        test_category: selectedCategory,
        trial_1: isLoadBased ? (trialLoads[0] && trialReps[0] ? calcE1RM(parseFloat(trialLoads[0]), parseInt(trialReps[0])) : null) : parseFloat(trialValues[0]) || null,
        trial_2: isLoadBased ? (trialLoads[1] && trialReps[1] ? calcE1RM(parseFloat(trialLoads[1]), parseInt(trialReps[1])) : null) : parseFloat(trialValues[1]) || null,
        trial_3: isLoadBased ? (trialLoads[2] && trialReps[2] ? calcE1RM(parseFloat(trialLoads[2]), parseInt(trialReps[2])) : null) : parseFloat(trialValues[2]) || null,
        best_value: finalTrial.value,
        load_value: finalTrial.load || null,
        reps: finalTrial.reps || null,
        e1rm: isLoadBased ? finalTrial.value : null,
        relative_strength: isLoadBased ? calcRelativeStrength(finalTrial.value, latestBodyweight) : null,
        unit: currentTest.unit,
        flagged,
        saved_to_results: true,
      })

      // Save best to pfa_test_results
      const relStr = isLoadBased ? calcRelativeStrength(finalTrial.value, latestBodyweight) : null
      const { data: saved, error } = await supabase.from('pfa_test_results').insert({
        athlete_id: currentAthlete.id,
        session_id: sessionId,
        category: selectedCategory,
        test_type: selectedTestId,
        value: finalTrial.value,
        unit: currentTest.unit,
        higher_is_better: !isLower,
        flagged,
        load_value: finalTrial.load || null,
        reps: finalTrial.reps || null,
        relative_strength: relStr,
        date_tested: new Date().toISOString(),
      }).select('*').single()

      if (error) throw error
      setResults(prev => [...prev, saved])

      // Confirmation flash then advance
      const confirmMsg = isLoadBased
        ? `✓ ${finalTrial.value} lbs · e1RM · ${finalTrial.load}×${finalTrial.reps} saved` 
        : `✓ ${finalTrial.value} ${currentTest.unit || ''} saved` 
      setSaveConfirm(confirmMsg)

      // Reset trial state
      setTrialValues(['', '', ''])
      setTrialLoads(['', '', ''])
      setTrialReps(['', '', ''])
      setSelectedTrial(0)
      setInputValue('')
      setLoadValue('')
      setRepsValue('')

      setTimeout(() => {
        setSaveConfirm('')
        setCurrentIndex(idx => Math.min(idx + 1, participants.length))
        loadHistory()
      }, 1500)

    } catch (err) {
      console.error('Save failed', err)
    }
  }

  const handleSkip = () => {
    setInputValue('')
    setLoadValue('')
    setRepsValue('')
    setCurrentIndex((idx) => Math.min(idx + 1, participants.length))
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSaveResult(false)
    } else if (e.key === 'Tab') {
      e.preventDefault()
      handleSkip()
    } else if (e.key.toLowerCase() === 'f' && !inputValue) {
      e.preventDefault()
      handleSaveResult(true)
    }
  }

  const toggleAthlete = (id) => {
    setSelectedAthleteIds((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    )
  }

  const getLastAndBaseline = () => {
    if (!currentAthlete || !selectedTestId) return { last: null, baseline: null }
    const relevant = results
      .filter((r) => r.athlete_id === currentAthlete.id && r.test_type === selectedTestId)
      .sort((a, b) => new Date(b.date_tested) - new Date(a.date_tested))
    const last = relevant[0] || null
    const baseline = relevant[relevant.length - 1] || null
    return { last, baseline }
  }

  const { last, baseline } = getLastAndBaseline()

  const getTrialBestIndex = () => {
    const isLoadBased = isLoadBasedTest(selectedTestId)
    const isLower = isLowerBetter(selectedTestId)
    let bestIdx = -1
    let bestVal = null
    for (let i = 0; i < 3; i++) {
      const val = isLoadBased
        ? (trialLoads[i] && trialReps[i] ? calcE1RM(parseFloat(trialLoads[i]), parseInt(trialReps[i])) : null)
        : (trialValues[i] !== '' ? parseFloat(trialValues[i]) : null)
      if (val === null || isNaN(val)) continue
      if (bestVal === null || (isLower ? val < bestVal : val > bestVal)) {
        bestVal = val
        bestIdx = i
      }
    }
    return bestIdx
  }

  const hasAnyTrial = () => {
    const isLoadBased = isLoadBasedTest(selectedTestId)
    if (isLoadBased) return trialLoads.some(v => v !== '') || trialReps.some(v => v !== '')
    return trialValues.some(v => v !== '')
  }

  const trialCount = () => {
    const isLoadBased = isLoadBasedTest(selectedTestId)
    if (isLoadBased) return trialLoads.filter((v, i) => v !== '' && trialReps[i] !== '').length
    return trialValues.filter(v => v !== '').length
  }

  const renderSetup = () => {
    const filteredAthletes = athletes.filter(a =>
      a.full_name?.toLowerCase().includes(athleteSearch.toLowerCase())
    )

    return (
      <div style={{ minHeight: '100dvh', background: '#0a0f0a', color: 'white', padding: '0 0 80px 0' }}>
        
        {/* Header */}
        <div style={{ padding: '20px 16px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button
              onClick={() => window.history.back()}
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(63,174,82,0.3)', borderRadius: '8px', color: '#3fae52', padding: '6px 14px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}
            >
              ← Admin
            </button>
            <div style={{ fontSize: '20px', fontWeight: '800', letterSpacing: '0.15em', color: '#3fae52' }}>TEST SESSION</div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {['session', 'history'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                style={{ padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', border: activeTab === tab ? '1px solid #3fae52' : '1px solid rgba(255,255,255,0.15)', background: activeTab === tab ? 'rgba(63,174,82,0.15)' : 'transparent', color: activeTab === tab ? '#3fae52' : 'rgba(255,255,255,0.6)', textTransform: 'capitalize' }}>
                {tab}
              </button>
            ))}
          </div>
        </div>

        {activeTab === 'history' ? renderHistory() : (
          <div style={{ padding: '16px' }}>

            {/* Active Sessions */}
            {activeSessions.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '11px', fontWeight: '700', color: '#3fae52', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '10px' }}>Active Sessions</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {activeSessions.map(s => (
                    <button key={s.id} onClick={() => handleJoinSession(s)}
                      style={{ width: '100%', textAlign: 'left', background: 'rgba(63,174,82,0.08)', border: '1px solid rgba(63,174,82,0.3)', borderRadius: '12px', padding: '14px 16px', cursor: 'pointer' }}>
                      <div style={{ color: 'white', fontWeight: '600', fontSize: '14px' }}>{s.pfa_teams?.name || 'No Team'}</div>
                      <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', marginTop: '2px' }}>{s.test_type} · Started {new Date(s.created_at).toLocaleTimeString()}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* New Session */}
            <div style={{ fontSize: '11px', fontWeight: '700', color: '#3fae52', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '12px' }}>New Session</div>

            {/* Athlete Mode Toggle */}
            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', padding: '3px', marginBottom: '16px' }}>
              {['team', 'individual'].map(mode => (
                <button key={mode} onClick={() => { setAthleteMode(mode); setSelectedTeamId(''); setSelectedAthleteIds([]) }}
                  style={{ flex: 1, padding: '8px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', border: 'none', background: athleteMode === mode ? 'rgba(63,174,82,0.2)' : 'transparent', color: athleteMode === mode ? '#3fae52' : 'rgba(255,255,255,0.5)', textTransform: 'capitalize' }}>
                  {mode}
                </button>
              ))}
            </div>

            {/* Team or Individual selection */}
            {athleteMode === 'team' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                {teams.map(team => (
                  <button key={team.id} onClick={() => setSelectedTeamId(team.id)}
                    style={{ padding: '14px 16px', borderRadius: '12px', border: selectedTeamId === team.id ? '2px solid #3fae52' : '1px solid rgba(255,255,255,0.1)', background: selectedTeamId === team.id ? 'rgba(63,174,82,0.1)' : 'rgba(255,255,255,0.03)', cursor: 'pointer', textAlign: 'left' }}>
                    <div style={{ color: 'white', fontWeight: '600', fontSize: '14px' }}>{team.name}</div>
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>{[team.sport, team.age_category].filter(Boolean).join(' · ')}</div>
                  </button>
                ))}
              </div>
            ) : (
              <div style={{ marginBottom: '16px' }}>
                <input value={athleteSearch} onChange={e => setAthleteSearch(e.target.value)}
                  placeholder="Search athletes..."
                  style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '10px 14px', color: 'white', fontSize: '14px', marginBottom: '10px', boxSizing: 'border-box' }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '240px', overflowY: 'auto' }}>
                  {filteredAthletes.map(ath => (
                    <button key={ath.id} onClick={() => toggleAthlete(ath.id)}
                      style={{ padding: '10px 14px', borderRadius: '10px', border: selectedAthleteIds.includes(ath.id) ? '2px solid #3fae52' : '1px solid rgba(255,255,255,0.08)', background: selectedAthleteIds.includes(ath.id) ? 'rgba(63,174,82,0.1)' : 'rgba(255,255,255,0.03)', cursor: 'pointer', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ color: 'white', fontSize: '13px', fontWeight: '500' }}>{ath.full_name}</div>
                        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px' }}>{[ath.sport, ath.position].filter(Boolean).join(' · ')}</div>
                      </div>
                      {selectedAthleteIds.includes(ath.id) && <div style={{ color: '#3fae52', fontSize: '16px' }}>✓</div>}
                    </button>
                  ))}
                </div>
                {selectedAthleteIds.length > 0 && (
                  <div style={{ fontSize: '12px', color: '#3fae52', marginTop: '8px' }}>{selectedAthleteIds.length} athlete{selectedAthleteIds.length > 1 ? 's' : ''} selected</div>
                )}
              </div>
            )}

            {/* Category Pills */}
            <div style={{ fontSize: '11px', fontWeight: '700', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>Category</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
              {[...TEST_CATEGORIES, { category: 'anthropometrics', label: 'Anthropometrics' }].map(cat => {
                const color = CATEGORY_COLORS[cat.label?.toUpperCase()] || CATEGORY_COLORS[cat.category?.toUpperCase()] || '#3fae52'
                const isSelected = selectedCategory === cat.category
                return (
                  <button key={cat.category} onClick={() => { setSelectedCategory(cat.category); setSelectedTestId('') }}
                    style={{ padding: '8px 16px', borderRadius: '20px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', border: isSelected ? `2px solid ${color}` : '1px solid rgba(255,255,255,0.12)', background: isSelected ? `${color}20` : 'rgba(255,255,255,0.04)', color: isSelected ? color : 'rgba(255,255,255,0.6)' }}>
                    {cat.label}
                  </button>
                )
              })}
            </div>

            {/* Test List */}
            {selectedCategory && (
              <>
                <div style={{ fontSize: '11px', fontWeight: '700', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>Test</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
                  {(selectedCategory === 'anthropometrics'
                    ? [{ test_type: 'inbody_scan', display_name: 'InBody Scan' }]
                    : availableTests[selectedCategory] || []
                  ).map(test => {
                    const id = test.test_type || test.id
                    const isSelected = selectedTestId === id
                    return (
                      <button key={id} onClick={() => setSelectedTestId(id)}
                        style={{ padding: '12px 16px', borderRadius: '10px', border: isSelected ? '2px solid #3fae52' : '1px solid rgba(255,255,255,0.08)', background: isSelected ? 'rgba(63,174,82,0.1)' : 'rgba(255,255,255,0.03)', cursor: 'pointer', textAlign: 'left', color: isSelected ? '#3fae52' : 'rgba(255,255,255,0.8)', fontWeight: isSelected ? '600' : '400', fontSize: '14px' }}>
                        {test.name || test.display_name}
                      </button>
                    )
                  })}
                </div>
              </>
            )}

            {/* Location */}
            <input value={location} onChange={e => setLocation(e.target.value)}
              placeholder="Location (optional)"
              style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '12px 14px', color: 'white', fontSize: '14px', marginBottom: '12px', boxSizing: 'border-box' }} />

            {startError && <div style={{ color: '#ef4444', fontSize: '13px', marginBottom: '10px' }}>{startError}</div>}

            {/* Start Button */}
            <button onClick={handleStartSession} disabled={starting}
              style={{ width: '100%', background: '#3fae52', color: 'black', fontWeight: '800', fontSize: '16px', padding: '16px', borderRadius: '14px', border: 'none', cursor: starting ? 'not-allowed' : 'pointer', opacity: starting ? 0.6 : 1, letterSpacing: '0.05em' }}>
              {starting ? 'Starting...' : 'Start Session'}
            </button>
          </div>
        )}
      </div>
    )
  }

  const renderLive = () => {
    const isLoadBased = isLoadBasedTest(selectedTestId)
    const isAnthro = selectedCategory === 'anthropometrics'
    const bestIdx = getTrialBestIndex()
    const totalAthletes = participants.length
    const progress = totalAthletes ? (currentIndex / totalAthletes) * 100 : 0
    const upNext = participants.slice(currentIndex + 1, currentIndex + 4)

    return (
      <div style={{ minHeight: '100dvh', background: '#0a0f0a', color: 'white', display: 'flex', flexDirection: 'column', maxWidth: '480px', margin: '0 auto' }}>

        {/* Top bar */}
        <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#3fae52' }}>{getTestLabel(selectedTestId)}</div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>{sessionInfo?.pfa_teams?.name || 'Individual'} · {sessionInfo?.location || 'No location'}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', fontWeight: '600' }}>{currentIndex}/{totalAthletes}</div>
            <button onClick={handleEndSession}
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', color: '#ef4444', padding: '5px 10px', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>
              End
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ height: '3px', background: 'rgba(255,255,255,0.08)' }}>
          <div style={{ height: '100%', width: `${progress}%`, background: '#3fae52', transition: 'width 0.3s' }} />
        </div>

        {/* Main content */}
        <div style={{ flex: 1, padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {saveConfirm ? (
            /* Confirmation flash */
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
              <div style={{ fontSize: '48px' }}>✓</div>
              <div style={{ fontSize: '18px', fontWeight: '700', color: '#3fae52', textAlign: 'center' }}>{saveConfirm}</div>
            </div>
          ) : currentAthlete ? (
            <>
              {/* Athlete info */}
              <div style={{ paddingBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: '28px', fontWeight: '800', color: 'white', lineHeight: 1.1 }}>{currentAthlete.full_name}</div>
                <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginTop: '4px' }}>
                  {[currentAthlete.sport, currentAthlete.position, currentAthlete.age_category].filter(Boolean).join(' · ')}
                </div>
                {last && (
                  <div style={{ marginTop: '6px', fontSize: '12px', color: 'rgba(255,255,255,0.35)' }}>
                    Last: <span style={{ color: 'rgba(255,255,255,0.6)' }}>{last.value}{last.unit || ''}</span>
                    {baseline && baseline.id !== last.id && <span style={{ marginLeft: '10px' }}>Baseline: <span style={{ color: 'rgba(255,255,255,0.6)' }}>{baseline.value}{baseline.unit || ''}</span></span>}
                  </div>
                )}
              </div>

              {/* Input area */}
              {isAnthro ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: '#ec4899', textTransform: 'uppercase', letterSpacing: '0.1em' }}>InBody Scan</div>
                  {[
                    { key: 'weight', label: 'Weight (lbs)', step: '0.1' },
                    { key: 'bodyFat', label: 'Body Fat %', step: '0.1' },
                    { key: 'height', label: 'Height (inches)', step: '0.5' },
                  ].map(field => (
                    <div key={field.key}>
                      <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginBottom: '4px' }}>{field.label}</div>
                      <input type="number" step={field.step} value={anthropoForm[field.key]}
                        onChange={e => setAnthropoForm(prev => ({ ...prev, [field.key]: e.target.value }))}
                        style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '12px', padding: '14px 16px', color: 'white', fontSize: '20px', boxSizing: 'border-box' }} />
                    </div>
                  ))}
                  {anthropoForm.height && <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>{Math.floor(anthropoForm.height/12)}'{Math.round(anthropoForm.height % 12)}"</div>}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {/* Trial inputs */}
                  {[0, 1, 2].map(i => {
                    const showTrial = i === 0 || (i === 1 && (isLoadBased ? (trialLoads[0] && trialReps[0]) : trialValues[0] !== '')) || (i === 2 && (isLoadBased ? (trialLoads[1] && trialReps[1]) : trialValues[1] !== ''))
                    if (!showTrial) return null

                    const isBest = bestIdx === i
                    const isSelected = selectedTrial === i

                    return (
                      <div key={i} onClick={() => setSelectedTrial(i)}
                        style={{ padding: '12px', borderRadius: '12px', border: isSelected ? '2px solid #3fae52' : isBest ? '2px solid rgba(63,174,82,0.4)' : '1px solid rgba(255,255,255,0.1)', background: isSelected ? 'rgba(63,174,82,0.08)' : 'rgba(255,255,255,0.03)', cursor: 'pointer' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <div style={{ fontSize: '11px', fontWeight: '700', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Trial {i + 1}</div>
                          {isBest && <div style={{ fontSize: '10px', fontWeight: '700', color: '#3fae52', background: 'rgba(63,174,82,0.15)', padding: '2px 8px', borderRadius: '10px' }}>★ BEST</div>}
                          {isSelected && !isBest && <div style={{ fontSize: '10px', fontWeight: '700', color: '#f59e0b', background: 'rgba(245,158,11,0.15)', padding: '2px 8px', borderRadius: '10px' }}>SELECTED</div>}
                        </div>

                        {isLoadBased ? (
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', marginBottom: '3px' }}>Load (lbs)</div>
                              <input ref={i === 0 ? inputRef : null} type="number" step="2.5" placeholder="225"
                                value={trialLoads[i]}
                                onChange={e => { const v = [...trialLoads]; v[i] = e.target.value; setTrialLoads(v); setSelectedTrial(i) }}
                                onClick={e => e.stopPropagation()}
                                style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', padding: '10px', color: 'white', fontSize: '18px', boxSizing: 'border-box' }} />
                            </div>
                            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '18px', paddingTop: '18px' }}>×</div>
                            <div style={{ width: '80px' }}>
                              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', marginBottom: '3px' }}>Reps</div>
                              <input type="number" step="1" min="1" max="30" placeholder="5"
                                value={trialReps[i]}
                                onChange={e => { const v = [...trialReps]; v[i] = e.target.value; setTrialReps(v); setSelectedTrial(i) }}
                                onClick={e => e.stopPropagation()}
                                style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', padding: '10px', color: 'white', fontSize: '18px', boxSizing: 'border-box' }} />
                            </div>
                          </div>
                        ) : (
                          <input ref={i === 0 ? inputRef : null} type="number" step="0.01" placeholder={currentTest?.unit || 'Value'}
                            value={trialValues[i]}
                            onChange={e => { const v = [...trialValues]; v[i] = e.target.value; setTrialValues(v); setSelectedTrial(i) }}
                            onClick={e => e.stopPropagation()}
                            style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', padding: '12px', color: 'white', fontSize: '24px', textAlign: 'center', boxSizing: 'border-box' }} />
                        )}

                        {isLoadBased && trialLoads[i] && trialReps[i] && (
                          <div style={{ marginTop: '6px', fontSize: '12px', color: '#3fae52', fontWeight: '600' }}>
                            e1RM: {calcE1RM(parseFloat(trialLoads[i]), parseInt(trialReps[i]))} lbs
                            {latestBodyweight && <span style={{ color: 'rgba(255,255,255,0.4)', marginLeft: '10px' }}>
                              {calcRelativeStrength(calcE1RM(parseFloat(trialLoads[i]), parseInt(trialReps[i])), latestBodyweight)}× BW
                            </span>}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Save / Skip / Flag */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: 'auto', paddingTop: '8px' }}>
                <button onClick={() => handleSaveResult(false)} disabled={!hasAnyTrial() && !isAnthro}
                  style={{ width: '100%', background: (hasAnyTrial() || isAnthro) ? '#3fae52' : 'rgba(63,174,82,0.2)', color: 'black', fontWeight: '800', fontSize: '17px', padding: '18px', borderRadius: '14px', border: 'none', cursor: (hasAnyTrial() || isAnthro) ? 'pointer' : 'not-allowed', letterSpacing: '0.03em' }}>
                  Save Best & Next
                </button>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={handleSkip}
                    style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '12px', color: 'rgba(255,255,255,0.7)', padding: '14px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>
                    Skip
                  </button>
                  <button onClick={() => handleSaveResult(true)} disabled={!hasAnyTrial()}
                    style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '12px', color: '#ef4444', padding: '14px 16px', fontSize: '14px', cursor: 'pointer' }}>
                    🚩
                  </button>
                </div>
              </div>

              {/* Up next queue */}
              {upNext.length > 0 && (
                <div style={{ paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>Up Next</div>
                  <div style={{ display: 'flex', gap: '8px', overflowX: 'auto' }}>
                    {upNext.map((ath, i) => (
                      <div key={ath.id} style={{ flexShrink: 0, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '8px 12px', fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>
                        {ath.full_name.split(' ')[0]}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            /* All done */
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', textAlign: 'center' }}>
              <div style={{ fontSize: '48px' }}>🏁</div>
              <div style={{ fontSize: '22px', fontWeight: '800', color: 'white' }}>All Done!</div>
              <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)' }}>{completedCount} results recorded</div>
              <button onClick={handleEndSession}
                style={{ background: 'rgba(63,174,82,0.15)', border: '1px solid rgba(63,174,82,0.3)', borderRadius: '12px', color: '#3fae52', padding: '14px 32px', fontSize: '15px', fontWeight: '700', cursor: 'pointer' }}>
                End Session
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  const renderHistory = () => (
    <div style={{ padding: '16px' }}>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
        <input value={historySearch} onChange={e => setHistorySearch(e.target.value)}
          placeholder="Search athlete..."
          style={{ flex: 1, minWidth: '160px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '10px 12px', color: 'white', fontSize: '13px' }} />
        <select value={historyCategory} onChange={e => setHistoryCategory(e.target.value)}
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '10px 12px', color: 'white', fontSize: '13px' }}>
          {['All', 'Speed', 'Power', 'Strength', 'Agility', 'Endurance', 'Anthropometrics'].map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      {sessionHistory.length === 0 ? (
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', textAlign: 'center', paddingTop: '40px' }}>No history yet.</div>
      ) : (() => {
        const grouped = {}
        sessionHistory.forEach(item => {
          const dateOnly = new Date(item.date_tested).toISOString().split('T')[0]
          if (!grouped[dateOnly]) grouped[dateOnly] = []
          grouped[dateOnly].push(item)
        })
        return Object.keys(grouped).sort((a,b) => new Date(b)-new Date(a)).map(date => {
          const items = grouped[date]
          const expanded = !!expandedDates[date]
          return (
            <div key={date} style={{ marginBottom: '8px', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', overflow: 'hidden' }}>
              <div onClick={() => setExpandedDates(prev => ({ ...prev, [date]: !prev[date] }))}
                style={{ padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', background: 'rgba(255,255,255,0.02)' }}>
                <div style={{ fontWeight: '600', color: 'white', fontSize: '14px' }}>{new Date(date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>{items.length} results</div>
                  <div style={{ color: '#3fae52', fontSize: '12px' }}>{expanded ? '▲' : '▼'}</div>
                </div>
              </div>
              {expanded && (
                <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {items
                    .filter(i => historyCategory === 'All' || (i.category || '').toLowerCase() === historyCategory.toLowerCase())
                    .filter(i => !historySearch || i.profiles?.full_name?.toLowerCase().includes(historySearch.toLowerCase()))
                    .map((item, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <div>
                          <div style={{ fontSize: '13px', color: 'white', fontWeight: '500' }}>{item.profiles?.full_name}</div>
                          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>{getTestLabel(item.test_type)}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '14px', fontWeight: '700', color: '#3fae52' }}>{item.value}{item.unit || ''}</div>
                          {item.load_value && item.reps && <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)' }}>{item.load_value}×{item.reps}</div>}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )
        })
      })()}
    </div>
  )

  if (loading) {
    return (
      <DashboardLayout>
        <div className="min-h-screen bg-[#0a0f0a] flex items-center justify-center text-white">Loading...</div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      {sessionId ? renderLive() : renderSetup()}
    </DashboardLayout>
  )
}

export default Session
