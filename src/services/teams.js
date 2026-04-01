import { supabase } from './supabase'

export const getAllTeams = async () => {
  const { data, error } = await supabase.from('pfa_teams').select('*').order('name')
  if (error) throw error
  return data
}

export const getTeam = async (id) => {
  const { data, error } = await supabase.from('pfa_teams').select('*').eq('id', id).single()
  if (error) throw error
  return data
}

export const createTeam = async (teamData) => {
  const { data, error } = await supabase.from('pfa_teams').insert(teamData).select().single()
  if (error) throw error
  return data
}

export const updateTeam = async (id, updates) => {
  const { data, error } = await supabase
    .from('pfa_teams')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export const getTeamRoster = async (teamId) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('team_id', teamId)
    .eq('role', 'athlete')
    .order('full_name')
  if (error) throw error
  return data
}
