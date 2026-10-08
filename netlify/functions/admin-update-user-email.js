const { createClient } = require('@supabase/supabase-js')

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' }
  }

  const authorization = event.headers.authorization || event.headers.Authorization || ''
  const token = authorization.replace(/^Bearer\s+/i, '')
  if (!token || token === authorization) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) }
  }

  const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !authData?.user) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) }
  }

  const { data: callerProfile, error: callerError } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', authData.user.id)
    .single()

  if (callerError || callerProfile?.role !== 'pfa_admin') {
    return { statusCode: 403, body: JSON.stringify({ error: 'Forbidden' }) }
  }

  const body = JSON.parse(event.body)
  const { userId, email } = body

  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { email })

  if (error) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: error.message }),
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ success: true }),
  }
}
