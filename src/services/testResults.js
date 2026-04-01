import { supabase } from './supabase'

export const getResultsForAthlete = async (athleteId) => {
  const { data, error } = await supabase
    .from('pfa_test_results')
    .select('*')
    .eq('athlete_id', athleteId)
    .order('date_tested', { ascending: false })
  if (error) throw error
  return data
}

export const getResultsForSession = async (sessionId) => {
  const { data, error } = await supabase
    .from('pfa_test_results')
    .select('*')
    .eq('session_id', sessionId)
    .order('date_tested', { ascending: false })
  if (error) throw error
  return data
}

export const getLatestResults = async (athleteId) => {
  const { data, error } = await supabase
    .from('pfa_test_results')
    .select('*')
    .eq('athlete_id', athleteId)
    .order('date_tested', { ascending: false })
  if (error) throw error
  const latest = {}
  for (const result of data || []) {
    if (!latest[result.test_type]) {
      latest[result.test_type] = result
    }
  }
  return Object.values(latest)
}

export const getBaselineResults = async (athleteId) => {
  const { data, error } = await supabase
    .from('pfa_test_results')
    .select('*')
    .eq('athlete_id', athleteId)
    .order('date_tested', { ascending: true })
  if (error) throw error
  const baseline = {}
  for (const result of data || []) {
    if (!baseline[result.test_type]) {
      baseline[result.test_type] = result
    }
  }
  return Object.values(baseline)
}

export const saveTestResult = async (resultData) => {
  const { data, error } = await supabase.from('pfa_test_results').insert(resultData).select().single()
  if (error) throw error
  return data
}

export const getTeamResults = async (teamId, testType) => {
  const { data, error } = await supabase
    .from('pfa_test_results')
    .select('*, profiles(full_name, team_id)')
    .eq('profiles.team_id', teamId)
    .eq('test_type', testType)
    .order('date_tested', { ascending: false })
  if (error) throw error
  return data
}
