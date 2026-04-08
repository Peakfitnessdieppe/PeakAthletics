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
}

const CATEGORY_COLORS = {
  SPEED: '#3fae52',
  POWER: '#f59e0b',
  STRENGTH: '#ef4444',
  AGILITY: '#8b5cf6',
  ENDURANCE: '#06b6d4',
  ANTHROPOMETRICS: '#ec4899',
}

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
  const inputRef = useRef(null)

  const currentAthlete = participants[currentIndex] || null
  const currentTest = useMemo(() => getTest(selectedTestId), [selectedTestId])
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
        .select('id, test_type, value, date_tested, category, athlete_id, profiles(full_name, sport, position)')
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
      } else {
        if (!currentTest) return
        const numericValue = parseFloat(inputValue)
        if (Number.isNaN(numericValue)) return
        const saved = await saveTestResult({
          athlete_id: currentAthlete.id,
          session_id: sessionId,
          category: selectedCategory,
          test_type: selectedTestId,
          value: numericValue,
          unit: currentTest.unit,
          higher_is_better: currentTest.higherIsBetter,
          flagged,
          date_tested: new Date().toISOString(),
        })
        setResults((prev) => [...prev, saved])
        setInputValue('')
        loadHistory()
      }
      setCurrentIndex((idx) => Math.min(idx + 1, participants.length))
    } catch (err) {
      console.error('Save failed', err)
    }
  }

  const handleSkip = () => {
    setInputValue('')
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

  const renderSetup = () => (
    <div className="min-h-screen bg-[#0a0f0a] text-white px-6 py-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="text-3xl font-extrabold tracking-[0.2em] text-pfa-green">TEST SESSION</div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-[#0d1a0e] border border-pfa-border rounded-2xl p-6 space-y-4">
            <div className="text-xl font-semibold text-pfa-green">Start New Session</div>
            <div className="space-y-3">
              <div>
                <div className="text-sm text-white/70 mb-1">Team/Group</div>
                <select
                  value={selectedTeamId}
                  onChange={(e) => {
                    setSelectedTeamId(e.target.value)
                    setSelectedAthleteIds([])
                    setStartError('')
                  }}
                  className="w-full bg-[#0a0f0a] border border-pfa-border rounded-lg px-3 py-2 text-white"
                >
                  <option value="">No Team / Individual Athletes</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                      {team.sport ? ` • ${team.sport}` : ''}
                      {team.age_category ? ` • ${team.age_category}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {!selectedTeamId && (
                <div>
                  <div className="text-sm text-white/70 mb-2">Select Athletes</div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-52 overflow-y-auto">
                    {athletes.map((ath) => (
                      <label
                        key={ath.id}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer ${
                          selectedAthleteIds.includes(ath.id)
                            ? 'border-pfa-green bg-pfa-green/10'
                            : 'border-pfa-border'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedAthleteIds.includes(ath.id)}
                          onChange={() => toggleAthlete(ath.id)}
                          className="accent-pfa-green"
                        />
                        <span className="text-sm text-white/80">{ath.full_name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <div className="text-sm text-white/70 mb-1">Test Category</div>
                  <select
                    value={selectedCategory}
                    onChange={(e) => {
                      setSelectedCategory(e.target.value)
                      setSelectedTestId('')
                      setStartError('')
                    }}
                    className="w-full bg-[#0a0f0a] border border-pfa-border rounded-lg px-3 py-2 text-white"
                  >
                    <option value="">Select category</option>
                    {[...TEST_CATEGORIES, { category: 'anthropometrics', label: 'Anthropometrics', tests: [] }].map((cat) => (
                      <option key={cat.category} value={cat.category}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <div className="text-sm text-white/70 mb-1">Test</div>
                  <select
                    value={selectedTestId}
                    onChange={(e) => setSelectedTestId(e.target.value)}
                    className="w-full bg-[#0a0f0a] border border-pfa-border rounded-lg px-3 py-2 text-white"
                    disabled={!selectedCategory}
                  >
                    <option value="">Select test</option>
                    {selectedCategory === 'anthropometrics'
                      ? [{ id: 'inbody_scan', name: 'InBody Scan' }].map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))
                      : TEST_CATEGORIES.find((c) => c.category === selectedCategory)?.tests.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                  </select>
                </div>
              </div>

              <div>
                <div className="text-sm text-white/70 mb-1">Location (optional)</div>
                <input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full bg-[#0a0f0a] border border-pfa-border rounded-lg px-3 py-2 text-white"
                  placeholder="Gym, Field, etc."
                />
              </div>

              {startError && <div className="text-red-400 text-sm">{startError}</div>}

              <button
                onClick={handleStartSession}
                disabled={starting}
                className="w-full bg-pfa-green text-black font-bold py-3 rounded-lg hover:brightness-110 transition disabled:opacity-60"
              >
                {starting ? 'Starting...' : 'Start Session'}
              </button>
            </div>
          </div>

          <div className="bg-[#0d1a0e] border border-pfa-border rounded-2xl p-6 space-y-4">
            <div className="text-xl font-semibold text-pfa-green">Join Active Session</div>
            {activeSessions.length === 0 ? (
              <div className="text-white/60">No in-progress sessions today.</div>
            ) : (
              <div className="space-y-3">
                {activeSessions.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => handleJoinSession(s)}
                    className="w-full text-left bg-white/5 border border-pfa-border hover:border-pfa-green rounded-lg px-4 py-3"
                  >
                    <div className="text-white font-semibold">{s.pfa_teams?.name || 'No Team'}</div>
                    <div className="text-white/60 text-sm">{s.test_type}</div>
                    <div className="text-white/40 text-xs">Started: {new Date(s.created_at).toLocaleTimeString()}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )

  const renderLive = () => (
    <div className="min-h-screen bg-[#0a0f0a] text-white px-4 md:px-8 py-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <div className="text-lg font-semibold text-pfa-green">{sessionInfo?.pfa_teams?.name || 'Individual Session'}</div>
            <div className="text-sm text-white/70">
              {currentTest?.name || 'Test'} · {sessionInfo?.session_date || new Date().toISOString().slice(0, 10)}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm text-white/70">{completedCount} / {participants.length}</div>
            <button
              onClick={handleEndSession}
              className="px-4 py-2 rounded-lg border border-red-500 text-red-400 hover:bg-red-500/10"
            >
              End Session
            </button>
          </div>
        </div>
        <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-pfa-green"
            style={{ width: participants.length ? `${(completedCount / participants.length) * 100}%` : '0%' }}
          />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
          <div className="xl:col-span-3 bg-[#0d1a0e] border border-pfa-border rounded-2xl p-6 flex flex-col gap-4">
            {currentAthlete ? (
              <>
                <div>
                  <div className="text-3xl font-bold">{currentAthlete.full_name}</div>
                  <div className="text-pfa-green text-sm">{currentAthlete.sport || 'Sport'} {currentAthlete.position ? `· ${currentAthlete.position}` : ''}</div>
                </div>
                <div className="text-white/60 text-sm flex gap-4">
                  <span>Last: {last ? `${last.value}${last.unit ? last.unit : ''}` : '—'}</span>
                  <span>Baseline: {baseline ? `${baseline.value}${baseline.unit ? baseline.unit : ''}` : '—'}</span>
                </div>

                <div>
                  {selectedCategory === 'anthropometrics' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '11px', fontWeight: '700', letterSpacing: '0.1em' }}>INBODY SCAN</div>
                      <input
                        type="number"
                        step="0.1"
                        placeholder="Weight (lbs)"
                        value={anthropoForm.weight}
                        onChange={(e) => setAnthropoForm({ ...anthropoForm, weight: e.target.value })}
                        style={inputStyle}
                      />
                      <input
                        type="number"
                        step="0.1"
                        placeholder="Body Fat %"
                        value={anthropoForm.bodyFat}
                        onChange={(e) => setAnthropoForm({ ...anthropoForm, bodyFat: e.target.value })}
                        style={inputStyle}
                      />
                      <input
                        type="number"
                        step="0.5"
                        placeholder="Height (inches)"
                        value={anthropoForm.height}
                        onChange={(e) => setAnthropoForm({ ...anthropoForm, height: e.target.value })}
                        style={inputStyle}
                      />
                      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px' }}>
                        {anthropoForm.height ? `${Math.floor(anthropoForm.height / 12)}'${Math.round(anthropoForm.height % 12)}` : ''}
                      </div>
                    </div>
                  ) : (
                    <input
                      ref={inputRef}
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={currentTest?.unit || ''}
                      className="w-48 text-center text-5xl bg-[#0a0f0a] border border-pfa-border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-pfa-green"
                    />
                  )}
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => handleSaveResult(false)}
                    className="bg-pfa-green text-black font-semibold px-4 py-3 rounded-lg hover:brightness-110"
                  >
                    Save & Next
                  </button>
                  <button
                    onClick={handleSkip}
                    className="border border-pfa-border text-white/80 px-4 py-3 rounded-lg hover:border-white/40"
                  >
                    Skip
                  </button>
                  <button
                    onClick={() => handleSaveResult(true)}
                    className="border border-red-500 text-red-400 px-4 py-3 rounded-lg hover:bg-red-500/10"
                  >
                    Flag
                  </button>
                </div>

                <div className="text-white/50 text-sm mt-6 flex gap-6">
                  <span>Enter → Save & Next</span>
                  <span>Tab → Skip</span>
                  <span>F → Flag</span>
                </div>
              </>
            ) : (
              <div className="text-white/80 space-y-3">
                <div className="text-xl font-semibold">All athletes completed!</div>
                <button
                  onClick={handleEndSession}
                  className="px-4 py-2 rounded-lg border border-pfa-border text-white/80 hover:border-pfa-green"
                >
                  End Session
                </button>
              </div>
            )}
          </div>

          <div className="hidden xl:block bg-[#0d1a0e] border border-pfa-border rounded-2xl p-4">
            <div className="text-sm text-white/70 mb-3">Queue</div>
            <div className="space-y-2 max-h-[70vh] overflow-y-auto">
              {participants.map((ath, idx) => {
                const res = results.find((r) => r.athlete_id === ath.id && r.test_type === selectedTestId)
                const isCurrent = idx === currentIndex
                return (
                  <div
                    key={ath.id}
                    className={`px-3 py-2 rounded-lg border ${isCurrent ? 'border-pfa-green bg-pfa-green/5' : 'border-pfa-border'}`}
                  >
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-white/80">{ath.full_name}</span>
                      <span className="text-white/50 text-xs">
                        {res ? res.value : idx < currentIndex ? '—' : ''}
                      </span>
                    </div>
                    {res && <div className="text-pfa-green text-xs">✔ Completed</div>}
                    {idx < currentIndex && !res && <div className="text-white/50 text-xs">Skipped</div>}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

      </div>
    </div>
  )

  const renderHistory = () => (
    <div className="max-w-6xl mx-auto" style={{ borderTop: '1px solid rgba(63,174,82,0.2)', marginTop: '40px', paddingTop: '32px' }}>
      <div className="text-2xl font-bold text-white mb-4">Test History</div>

      <div className="flex flex-col md:flex-row gap-3 mb-4">
        <input
          value={historySearch}
          onChange={(e) => setHistorySearch(e.target.value)}
          placeholder="Search athlete..."
          className="w-full md:w-64 bg-[#0d1a0e] border border-pfa-border rounded-lg px-3 py-2 text-sm text-white"
        />
        <select
          value={historyCategory}
          onChange={(e) => setHistoryCategory(e.target.value)}
          className="w-full md:w-48 bg-[#0d1a0e] border border-pfa-border rounded-lg px-3 py-2 text-sm text-white"
        >
          {['All', 'Speed', 'Power', 'Strength', 'Agility', 'Endurance', 'Anthropometrics'].map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      {sessionHistory.length === 0 ? (
        <div className="text-white/60">No sessions recorded yet.</div>
      ) : (
        <div className="space-y-2">
          {(() => {
            const grouped = {}
            sessionHistory.forEach((item) => {
              const dateOnly = new Date(item.date_tested).toISOString().split('T')[0]
              if (!grouped[dateOnly]) grouped[dateOnly] = []
              grouped[dateOnly].push(item)
            })
            const sortedDates = Object.keys(grouped).sort((a, b) => new Date(b) - new Date(a))

            return sortedDates.map((date) => {
              const items = grouped[date]
              const uniqueAthletes = new Set(items.map((i) => i.athlete_id)).size
              const uniqueCategories = Array.from(new Set(items.map((i) => (i.category || '').toUpperCase()))).filter(Boolean)
              const totalResults = items.length
              const resultsByCategory = {}
              items.forEach((i) => {
                const cat = (i.category || 'Unknown').toUpperCase()
                if (!resultsByCategory[cat]) resultsByCategory[cat] = {}
                if (!resultsByCategory[cat][i.test_type]) resultsByCategory[cat][i.test_type] = []
                resultsByCategory[cat][i.test_type].push({
                  full_name: i.profiles?.full_name,
                  sport: i.profiles?.sport,
                  position: i.profiles?.position,
                  value: i.value,
                })
              })

              const expanded = !!expandedDates[date]
              const formattedDate = new Date(date).toLocaleDateString(undefined, {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })

              return (
                <div key={date} className={`bg-[#0d1a0e] border-b border-[rgba(63,174,82,0.2)] ${expanded ? 'border-l-4 border-l-pfa-green' : ''}`}>
                  <div
                    className="flex items-center justify-between gap-3 cursor-pointer hover:brightness-110"
                    style={{ padding: '14px 16px' }}
                    onClick={() => setExpandedDates((prev) => ({ ...prev, [date]: !prev[date] }))}
                  >
                    <div className="text-white font-semibold">{formattedDate}</div>
                    <div className="flex items-center gap-2 flex-wrap justify-center">
                      {uniqueCategories.map((cat) => (
                        <span
                          key={cat}
                          style={{
                            background: `${(CATEGORY_COLORS[cat] || '#3fae52')}20`,
                            color: CATEGORY_COLORS[cat] || '#3fae52',
                            border: `1px solid ${(CATEGORY_COLORS[cat] || '#3fae52')}40`,
                            padding: '4px 8px',
                            borderRadius: '9999px',
                            fontSize: '10px',
                            fontWeight: 700,
                            letterSpacing: '0.05em',
                          }}
                        >
                          {cat}
                        </span>
                      ))}
                    </div>
                    <div className="text-white/70 text-sm flex items-center gap-2">
                      <span>
                        {uniqueAthletes} athletes · {totalResults} results
                      </span>
                      <span className="text-pfa-green">{expanded ? '▲' : '▼'}</span>
                    </div>
                  </div>

                  {expanded && (
                    <div style={{ padding: '0 16px 16px' }}>
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                          gap: '12px',
                          paddingTop: '12px',
                        }}
                      >
                        {Object.entries(resultsByCategory)
                          .filter(([cat]) => historyCategory === 'All' || cat === historyCategory.toUpperCase())
                          .map(([cat, tests]) => {
                            const testEntries = Object.entries(tests)
                            const totalTests = testEntries.length
                            const athleteIds = new Set()
                            testEntries.forEach(([, list]) => list.forEach((ath) => athleteIds.add(ath.full_name)))
                            const matchSearch = (name) => {
                              if (!historySearch) return true
                              return name?.toLowerCase().includes(historySearch.toLowerCase())
                            }

                            return (
                              <div
                                key={cat}
                                style={{
                                  background: '#0a0f0a',
                                  border: '1px solid rgba(63,174,82,0.15)',
                                  borderRadius: '10px',
                                  padding: '12px',
                                }}
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <div
                                    style={{
                                      color: CATEGORY_COLORS[cat] || '#3fae52',
                                      fontWeight: 800,
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
                                      borderRadius: '9999px',
                                    }}
                                  >
                                    {totalTests} tests · {athleteIds.size} athletes
                                  </div>
                                </div>
                                <div className="space-y-3">
                                  {testEntries.map(([testType, athleteList]) => {
                                    const label = TEST_LABELS[testType] || testType
                                    const unit = TEST_UNITS[testType] || ''
                                    return (
                                      <div key={testType}>
                                        <div className="text-white/80 text-sm font-semibold mb-1">{label}</div>
                                        <div className="space-y-1">
                                          {athleteList.map((ath, idx) => {
                                            const matches = matchSearch(ath.full_name)
                                            const shouldDim = historySearch && !matches
                                            return (
                                              <div
                                                key={`${testType}-${idx}-${ath.full_name}`}
                                                style={{
                                                  background: matches ? 'rgba(63,174,82,0.1)' : 'transparent',
                                                  opacity: shouldDim ? 0.3 : 1,
                                                  padding: '6px 8px',
                                                  borderRadius: '8px',
                                                  border: '1px solid rgba(255,255,255,0.04)',
                                                }}
                                              >
                                                <div className="text-sm font-semibold text-white">{ath.full_name || 'Unknown'}</div>
                                                <div className="text-xs text-white/60">
                                                  {ath.sport || 'Sport'} {ath.position ? `· ${ath.position}` : ''}
                                                </div>
                                                <div className="text-xs text-pfa-green font-semibold">{ath.value}{unit}</div>
                                              </div>
                                            )
                                          })}
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            )
                          })}
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          })()}
        </div>
      )}
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
      <>
        {sessionId ? renderLive() : renderSetup()}
        {renderHistory()}
      </>
    </DashboardLayout>
  )
}

export default Session
