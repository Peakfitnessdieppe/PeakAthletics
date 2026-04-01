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
