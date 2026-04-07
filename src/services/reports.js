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

  return { profile, results: results || [], benchmarks: benchmarks || [] }
}

export const getPfaAverageScores = async (sport, ageCategory) => {
  let query = supabase.from('pfa_test_results').select('athlete_id, test_type, category, value, higher_is_better')
  if (sport) query = query.eq('sport', sport)
  const { data, error } = await query
  if (error) {
    console.warn('PFA averages fetch failed:', error.message)
    return []
  }
  return Array.isArray(data) ? data : []
}

export const getTeamAverageResults = async (teamId) => {
  if (!teamId) return []
  const { data: members, error: membError } = await supabase
    .from('profiles')
    .select('id')
    .eq('team_id', teamId)
    .eq('role', 'athlete')
  if (membError) return []
  const ids = (members || []).map((m) => m.id)
  if (!ids.length) return []
  const { data, error } = await supabase
    .from('pfa_test_results')
    .select('athlete_id, test_type, category, value, higher_is_better')
    .in('athlete_id', ids)
  if (error) return []
  return Array.isArray(data) ? data : []
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
