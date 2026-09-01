import { supabase } from './supabase'

export const getAthleteReport = async (athleteId) => {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*, pfa_teams(name, sport, primary_color, secondary_color)')
    .eq('id', athleteId)
    .single()
  if (profileError) throw profileError

  const { data: results, error: resultsError } = await supabase
    .from('pfa_test_results')
    .select('*')
    .eq('athlete_id', athleteId)
    .order('date_tested', { ascending: true })
  if (resultsError) throw resultsError

  const { data: benchmarks, error: benchError } = await supabase
    .from('pfa_benchmarks')
    .select('*')
  if (benchError) {
    console.warn('Benchmarks fetch failed (table may not exist):', benchError.message)
  }

  const { data: peerAverages } = await supabase
    .from('pfa_test_results')
    .select('test_type, value, profiles!inner(gender, age_category)')
    .eq('profiles.gender', profile.gender)
    .eq('profiles.age_category', profile.age_category)
    .in('test_type', ['push_ups', 'squat', 'bench_press', 'trap_bar_deadlift'])
    .not('value', 'is', null)

  const peerAvgMap = {}
  if (peerAverages) {
    const grouped = {}
    peerAverages.forEach(r => {
      if (!grouped[r.test_type]) grouped[r.test_type] = []
      grouped[r.test_type].push(r.value)
    })
    Object.keys(grouped).forEach(tt => {
      const vals = grouped[tt]
      peerAvgMap[tt] = Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100
    })
  }

  return { profile, results: results || [], benchmarks: benchmarks || [], peerAvgMap }
}

export const getPfaAverageScores = async (sport, ageCategory, gender) => {
  const { data: athleteIds, error: idError } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'athlete')
    .eq('sport', sport)
    .eq('gender', gender)
  if (idError || !athleteIds?.length) return []
  const ids = athleteIds.map((a) => a.id)
  const { data, error } = await supabase
    .from('pfa_test_results')
    .select('athlete_id, test_type, category, value, higher_is_better')
    .in('athlete_id', ids)
  if (error) return []
  return Array.isArray(data) ? data : []
}

export const getAgeGroupAverageResults = async (sport, ageCategory, gender) => {
  if (!sport || !ageCategory || !gender) return []
  const { data: athleteIds, error: idError } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'athlete')
    .eq('sport', sport)
    .eq('age_category', ageCategory)
    .eq('gender', gender)
  if (idError || !athleteIds?.length) return []
  const ids = athleteIds.map((a) => a.id)
  const { data, error } = await supabase
    .from('pfa_test_results')
    .select('athlete_id, test_type, category, value, higher_is_better')
    .in('athlete_id', ids)
  if (error) return []
  return Array.isArray(data) ? data : []
}

export const getAthleteGameStats = async (athleteId) => {
  const { data, error } = await supabase
    .from('game_stats')
    .select('*')
    .eq('athlete_id', athleteId)
    .order('scraped_at', { ascending: false })
  if (error) throw error
  return data || []
}

export const getPeerStats = async (sport, ageCategory, gender) => {
  const { data, error } = await supabase
    .from('pfa_peer_stats')
    .select('*')
    .eq('sport', sport)
    .eq('age_category', ageCategory)
    .eq('gender', gender)
    .gte('n', 5)
  if (error || !data) return []
  return data
}

export const getAthleteTestRankings = async (athleteId, ageCategory, gender) => {
  const LOWER_IS_BETTER = ['10m_sprint', '30m_sprint', 'pro_agility_shuttle']

  const { data: results, error } = await supabase
    .from('pfa_test_results')
    .select('test_type, value, date_tested, category')
    .eq('athlete_id', athleteId)
    .order('date_tested', { ascending: false })
  if (error || !results?.length) return []

  const bestByTest = {}
  for (const r of results) {
    if (!bestByTest[r.test_type]) {
      bestByTest[r.test_type] = r
    } else {
      const current = bestByTest[r.test_type]
      const isBetter = LOWER_IS_BETTER.includes(r.test_type)
        ? r.value < current.value
        : r.value > current.value
      if (isBetter) bestByTest[r.test_type] = r
    }
  }

  const { data: cohortProfiles } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'athlete')
    .eq('age_category', ageCategory)
    .eq('gender', gender)
  const cohortIds = (cohortProfiles || []).map((p) => p.id)

  const rankings = []
  for (const [testType, best] of Object.entries(bestByTest)) {
    const { data: cohortResults } = await supabase
      .from('pfa_test_results')
      .select('athlete_id, value')
      .eq('test_type', testType)
      .in('athlete_id', cohortIds)

    const bestPerAthlete = {}
    for (const r of cohortResults || []) {
      if (!bestPerAthlete[r.athlete_id]) {
        bestPerAthlete[r.athlete_id] = r.value
      } else {
        const isBetter = LOWER_IS_BETTER.includes(testType)
          ? r.value < bestPerAthlete[r.athlete_id]
          : r.value > bestPerAthlete[r.athlete_id]
        if (isBetter) bestPerAthlete[r.athlete_id] = r.value
      }
    }

    const sorted = Object.values(bestPerAthlete).sort((a, b) =>
      LOWER_IS_BETTER.includes(testType) ? a - b : b - a
    )
    const cohortSize = sorted.length
    const rank = cohortSize >= 5 ? sorted.indexOf(best.value) + 1 : null

    const { data: allTimeResults } = await supabase
      .from('pfa_test_results')
      .select('athlete_id, value')
      .eq('test_type', testType)

    const { data: allGenderProfiles } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'athlete')
      .eq('gender', gender)
    const allGenderIds = new Set((allGenderProfiles || []).map((p) => p.id))

    const allTimeBestPerAthlete = {}
    for (const r of allTimeResults || []) {
      if (!allGenderIds.has(r.athlete_id)) continue
      if (!allTimeBestPerAthlete[r.athlete_id]) {
        allTimeBestPerAthlete[r.athlete_id] = r.value
      } else {
        const isBetter = LOWER_IS_BETTER.includes(testType)
          ? r.value < allTimeBestPerAthlete[r.athlete_id]
          : r.value > allTimeBestPerAthlete[r.athlete_id]
        if (isBetter) allTimeBestPerAthlete[r.athlete_id] = r.value
      }
    }
    const allTimeSorted = Object.values(allTimeBestPerAthlete).sort((a, b) =>
      LOWER_IS_BETTER.includes(testType) ? a - b : b - a
    )
    const isAllTimeRecord = allTimeSorted.length > 0 && allTimeSorted[0] === best.value
    const isAgeGroupRecord = cohortSize >= 5 && rank === 1

    rankings.push({
      testType,
      value: best.value,
      dateTested: best.date_tested,
      category: best.category,
      rank,
      cohortSize,
      isAllTimeRecord,
      isAgeGroupRecord,
      ageCategory,
    })
  }

  return rankings.sort((a, b) => {
    if (a.rank === null && b.rank === null) return 0
    if (a.rank === null) return 1
    if (b.rank === null) return -1
    if (a.rank !== b.rank) return a.rank - b.rank
    return new Date(b.dateTested) - new Date(a.dateTested)
  })
}

export const getAthleteBodyMeasurements = async (athleteId) => {
  const { data, error } = await supabase
    .from('pfa_body_measurements')
    .select('*')
    .eq('athlete_id', athleteId)
    .order('measurement_date', { ascending: false })
  if (error) return []
  return data || []
}
