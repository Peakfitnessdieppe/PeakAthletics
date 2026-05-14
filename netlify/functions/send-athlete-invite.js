const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  try {
    const { athleteId, email, fullName } = JSON.parse(event.body)
    if (!athleteId || !email || !fullName) {
      return { statusCode: 400, body: JSON.stringify({ error: 'athleteId, email, and fullName are required' }) }
    }

    // Check if auth user already exists
    const { data: existingUsers } = await supabase.auth.admin.listUsers()
    const existingUser = existingUsers?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase())

    if (existingUser) {
      // User exists in auth — link their profile id to the auth user id if needed
      const { error: updateError } = await supabase.auth.admin.generateLink({
        type: 'recovery',
        email,
      })
      if (updateError) throw updateError
    } else {
      // Create new auth user with invite
      const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
        data: { full_name: fullName },
        redirectTo: `${process.env.URL || 'https://athletics.peakfitnessdieppe.ca'}/card`,
      })
      if (error) throw error
      
      // Update the profile id to match the new auth user id
      const newUserId = data?.user?.id
      if (newUserId && newUserId !== athleteId) {
        // Update all related tables to use new auth user id
        await supabase.from('pfa_test_results').update({ athlete_id: newUserId }).eq('athlete_id', athleteId)
        await supabase.from('pfa_composite_scores').update({ athlete_id: newUserId }).eq('athlete_id', athleteId)
        await supabase.from('pfa_body_measurements').update({ athlete_id: newUserId }).eq('athlete_id', athleteId)
        await supabase.from('game_stats').update({ athlete_id: newUserId }).eq('athlete_id', athleteId)
        await supabase.from('pfa_ai_insights').update({ athlete_id: newUserId }).eq('athlete_id', athleteId)
        await supabase.from('athlete_teams').update({ athlete_id: newUserId }).eq('athlete_id', athleteId)
        await supabase.from('pfa_coach_insights').update({ team_id: newUserId }).eq('team_id', athleteId)

        // Update the profile itself
        await supabase.from('profiles').update({ 
          id: newUserId,
          invite_sent_at: new Date().toISOString()
        }).eq('id', athleteId)
      } else {
        await supabase.from('profiles').update({ 
          invite_sent_at: new Date().toISOString()
        }).eq('id', athleteId)
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: `Invite sent to ${email}` }),
    }
  } catch (err) {
    console.error('send-athlete-invite error:', err)
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}
