import { supabase } from './supabase'

export const getAthleteProfile = async (id) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*, pfa_teams(name, sport, primary_color, secondary_color)')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export const saveBodyMeasurement = async (data) => {
  const { error } = await supabase
    .from('pfa_body_measurements')
    .insert({
      athlete_id: data.athleteId,
      measurement_date: data.date,
      height: data.height || null,
      weight: data.weight || null,
      body_fat_percentage: data.bodyFat || null,
      muscle_mass: data.muscleMass || null,
    })
  if (error) throw error
}

export const getAthleteRecentMeasurements = async (athleteId) => {
  const { data, error } = await supabase
    .from('pfa_body_measurements')
    .select('*')
    .eq('athlete_id', athleteId)
    .order('measurement_date', { ascending: false })
    .limit(5)
  if (error) return []
  return data || []
}

export const getAthletesByTeamJunction = async (teamId) => {
  const { data, error } = await supabase
    .from('athlete_teams')
    .select('profiles(*)')
    .eq('team_id', teamId)
    .order('profiles(full_name)')
  if (error) throw error
  return (data || []).map((row) => row.profiles)
}

export const getAthleteTeams = async (athleteId) => {
  const { data, error } = await supabase
    .from('athlete_teams')
    .select('*, pfa_teams(id, name, sport, age_category)')
    .eq('athlete_id', athleteId)
  if (error) throw error
  return data
}

export const addAthleteToTeam = async (athleteId, teamId) => {
  const { data, error } = await supabase
    .from('athlete_teams')
    .insert({ athlete_id: athleteId, team_id: teamId })
    .select()
    .single()
  if (error) throw error
  return data
}

export const removeAthleteFromTeam = async (athleteId, teamId) => {
  const { error } = await supabase
    .from('athlete_teams')
    .delete()
    .eq('athlete_id', athleteId)
    .eq('team_id', teamId)
  if (error) throw error
}

export const getCheckins = async (teamId = null) => {
  let query = supabase
    .from('athlete_checkins')
    .select('*, profiles(full_name)')
    .order('checkin_date', { ascending: false })
    .limit(50)
  if (teamId) {
    query = query.eq('profiles.team_id', teamId)
  }
  const { data, error } = await query
  if (error) throw error
  return data
}

export const markCheckinReviewed = async (checkinId, reviewedBy) => {
  const { error } = await supabase
    .from('athlete_checkins')
    .update({ reviewed_by: reviewedBy, flagged: false })
    .eq('id', checkinId)
  if (error) throw error
}

export const getRoster = async () => {
  const { data, error } = await supabase.from('athlete_roster').select('*').order('full_name')
  if (error) throw error
  return data
}

export const getRosterStats = async () => {
  const { count: total } = await supabase
    .from('athlete_roster')
    .select('*', { count: 'exact', head: true })

  const { count: linked } = await supabase
    .from('athlete_roster')
    .select('*', { count: 'exact', head: true })
    .eq('auth_linked', true)

  const { count: results } = await supabase
    .from('roster_test_results')
    .select('*', { count: 'exact', head: true })

  return {
    total: total || 0,
    linked: linked || 0,
    pending: (total || 0) - (linked || 0),
    results: results || 0,
  }
}

export const getAllAthletes = async () => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*, pfa_teams(name)')
    .eq('role', 'athlete')
    .order('full_name')
  if (error) throw error
  return data
}

export const getAthletesByTeam = async (teamId) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'athlete')
    .eq('team_id', teamId)
    .order('full_name')
  if (error) throw error
  return data
}

export const updateAthleteProfile = async (id, updates) => {
  const { data, error } = await supabase
    .from('profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}
