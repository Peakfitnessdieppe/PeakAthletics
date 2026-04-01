import { supabase } from './supabase'

export const createUser = async (userData) => {
  const {
    email,
    password,
    role,
    full_name,
    sport,
    position,
    date_of_birth,
    gender,
    age_category,
    competition_level,
    team_id,
    linked_athlete_id,
  } = userData

  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${window.location.origin}/login`,
      data: {
        full_name,
        role,
      },
    },
  })

  if (authError) throw authError
  if (!authData?.user) throw new Error('User creation failed')

  const { error: profileError } = await supabase.from('profiles').insert({
    id: authData.user.id,
    role,
    full_name,
    email,
    sport: sport || null,
    position: position || null,
    date_of_birth: date_of_birth || null,
    gender: gender || null,
    age_category: age_category || null,
    competition_level: competition_level || null,
    team_id: team_id || null,
    linked_athlete_id: linked_athlete_id || null,
  })

  if (profileError) throw profileError

  return authData.user
}

export const deleteUser = async (userId) => {
  const { error } = await supabase.from('profiles').delete().eq('id', userId)
  if (error) throw error
}

export const updateUser = async (userId, updates) => {
  const { error } = await supabase
    .from('profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', userId)
  if (error) throw error
}
