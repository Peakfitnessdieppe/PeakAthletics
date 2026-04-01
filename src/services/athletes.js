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
