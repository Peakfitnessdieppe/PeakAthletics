const { createClient } = require('@supabase/supabase-js')

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' }
  }

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  const body = JSON.parse(event.body)
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
  } = body

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (authError) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: authError.message }),
    }
  }

  const { error: profileError } = await supabase.from('profiles').insert({
    id: authData.user.id,
    role,
    full_name,
    email,
    sport,
    position,
    date_of_birth,
    gender,
    age_category,
    competition_level,
    team_id: team_id || null,
    linked_athlete_id: linked_athlete_id || null,
  })

  if (profileError) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: profileError.message }),
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ success: true, userId: authData.user.id }),
  }
}
