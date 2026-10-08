const { createClient } = require('@supabase/supabase-js')

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' })
  }

  const authorization = event.headers.authorization || event.headers.Authorization || ''
  const token = authorization.replace(/^Bearer\s+/i, '')
  if (!token || token === authorization) {
    return json(401, { error: 'Unauthorized' })
  }

  const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !authData?.user) {
    return json(401, { error: 'Unauthorized' })
  }

  const { data: callerProfile, error: callerError } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', authData.user.id)
    .single()

  if (callerError || callerProfile?.role !== 'pfa_admin') {
    return json(403, { error: 'Forbidden' })
  }

  let body
  try {
    body = JSON.parse(event.body || '{}')
  } catch {
    return json(400, { error: 'Invalid JSON body' })
  }
  const dryRun = body.dryRun !== false

  try {
    const profiles = []
    const profilePageSize = 1000
    for (let from = 0; ; from += profilePageSize) {
      const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('id, full_name, email')
        .eq('role', 'athlete')
        .not('email', 'is', null)
        .neq('email', '')
        .range(from, from + profilePageSize - 1)
      if (error) throw error
      profiles.push(...(data || []))
      if (!data || data.length < profilePageSize) break
    }

    const users = []
    const authPageSize = 1000
    for (let page = 1; ; page += 1) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: authPageSize })
      if (error) throw error
      const pageUsers = data?.users || []
      users.push(...pageUsers)
      if (pageUsers.length < authPageSize) break
    }

    const candidates = profiles.filter((profile) => {
      const email = profile.email.trim().toLowerCase()
      return email && !email.endsWith('@peakathletics.app')
    })
    const profileEmailCounts = candidates.reduce((counts, profile) => {
      const email = profile.email.trim().toLowerCase()
      counts.set(email, (counts.get(email) || 0) + 1)
      return counts
    }, new Map())
    const usersById = new Map(users.map((user) => [user.id, user]))
    const usersByEmail = users.reduce((lookup, user) => {
      const email = user.email?.trim().toLowerCase()
      if (email) lookup.set(email, [...(lookup.get(email) || []), user])
      return lookup
    }, new Map())

    const skipped = []
    const failed = []
    let updateCount = 0

    for (const profile of candidates) {
      const targetEmail = profile.email.trim().toLowerCase()
      const authUser = usersById.get(profile.id)
      const currentEmail = authUser?.email?.trim().toLowerCase()

      if (!authUser) {
        failed.push({ full_name: profile.full_name, error: 'Auth user not found' })
        continue
      }
      if (currentEmail === targetEmail) continue
      if (!isValidEmail(targetEmail)) {
        skipped.push({ full_name: profile.full_name, profile_email: profile.email, reason: 'invalid' })
        continue
      }
      if (profileEmailCounts.get(targetEmail) > 1) {
        skipped.push({ full_name: profile.full_name, profile_email: profile.email, reason: 'shared_email' })
        continue
      }
      if ((usersByEmail.get(targetEmail) || []).some((user) => user.id !== profile.id)) {
        skipped.push({ full_name: profile.full_name, profile_email: profile.email, reason: 'email_in_use' })
        continue
      }

      if (dryRun) {
        updateCount += 1
        continue
      }

      const { error } = await supabaseAdmin.auth.admin.updateUserById(profile.id, {
        email: targetEmail,
        email_confirm: true,
      })
      if (error) {
        failed.push({ full_name: profile.full_name, error: error.message })
      } else {
        updateCount += 1
      }
      await sleep(100)
    }

    return json(200, {
      dryRun,
      totalChecked: candidates.length,
      [dryRun ? 'willUpdate' : 'updated']: updateCount,
      skipped,
      failed,
    })
  } catch (error) {
    return json(500, { error: error.message })
  }
}
