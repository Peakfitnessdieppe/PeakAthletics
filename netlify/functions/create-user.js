const { createClient } = require('@supabase/supabase-js')

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  const { email, password, full_name, role, sport, age_category, position, gender, dob, competition_level, team_id } = JSON.parse(event.body)

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
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

  const userId = authData.user.id

  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .update({
      full_name,
      role,
      sport,
      age_category,
      position,
      gender,
      dob: dob || null,
      competition_level,
    })
    .eq('id', userId)

  if (profileError) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: profileError.message }),
    }
  }

  if (team_id) {
    await supabaseAdmin.from('athlete_teams').insert({ team_id, athlete_id: userId })
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ user: authData.user }),
  }
}
