const { createClient } = require('@supabase/supabase-js')

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' }
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  const body = JSON.parse(event.body)
  const { userId, email } = body

  const { error } = await supabase.auth.admin.updateUserById(userId, { email })

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
