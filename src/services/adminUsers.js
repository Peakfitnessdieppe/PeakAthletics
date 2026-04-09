import { supabase } from './supabase'

export const createUser = async (userData) => {
  const response = await fetch('/.netlify/functions/create-user', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: userData.email,
      password: userData.password,
      full_name: userData.full_name,
      role: userData.role,
      sport: userData.sport,
      age_category: userData.age_category,
      position: userData.position,
      gender: userData.gender,
      competition_level: userData.competition_level,
      team_id: userData.team_id || null,
    }),
  })

  const result = await response.json()
  if (!response.ok) throw new Error(result?.error || 'User creation failed')
  return result.user
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

export const createAndLinkAthlete = async (rosterAthlete, email, password) => {
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: rosterAthlete.full_name,
        role: 'athlete',
      },
    },
  })
  if (authError) throw authError
  if (!authData?.user) throw new Error('User creation failed')

  const userId = authData.user.id

  const { error: profileError } = await supabase.from('profiles').insert({
    id: userId,
    role: 'athlete',
    full_name: rosterAthlete.full_name,
    email,
    sport: rosterAthlete.sport || null,
    position: rosterAthlete.position || null,
    date_of_birth: rosterAthlete.date_of_birth || null,
    gender: rosterAthlete.gender || null,
    age_category: rosterAthlete.age_category || null,
    competition_level: rosterAthlete.competition_level || null,
  })
  if (profileError) throw profileError

  const { data: results, error: resultsError } = await supabase
    .from('roster_test_results')
    .select('*')
    .eq('full_name', rosterAthlete.full_name)
  if (resultsError) throw resultsError

  if (results && results.length > 0) {
    const mapped = results.map((r) => ({
      athlete_id: userId,
      category: r.category,
      test_type: r.test_type,
      value: r.value,
      unit: r.unit,
      higher_is_better: getHigherIsBetter(r.test_type),
      date_tested: r.date_tested,
      migrated_from: 'roster_import',
    }))

    const { error: insertError } = await supabase.from('pfa_test_results').insert(mapped)
    if (insertError) throw insertError
  }

  const { error: updateError } = await supabase
    .from('athlete_roster')
    .update({ auth_linked: true })
    .eq('id', rosterAthlete.id)
  if (updateError) throw updateError

  return { userId, resultsCount: results?.length || 0 }
}

// Helper to determine higher_is_better from test_type
const getHigherIsBetter = (testType) => {
  const lowerIsBetter = ['10m_sprint', '30m_sprint', 'pro_agility_shuttle']
  return !lowerIsBetter.includes(testType)
}
