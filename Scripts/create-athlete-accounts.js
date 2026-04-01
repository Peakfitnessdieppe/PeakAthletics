import { createRequire } from 'module'

const require = createRequire(import.meta.url)
require('dotenv').config()
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const LOWER_IS_BETTER = ['10m_sprint', '30m_sprint', 'pro_agility_shuttle']
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const run = async () => {
  const { data: athletes, error: rosterError } = await supabase
    .from('athlete_roster')
    .select('*')
    .eq('auth_linked', false)
    .order('full_name')

  if (rosterError) {
    console.error('Failed to fetch roster:', rosterError.message)
    process.exit(1)
  }

  console.log(`Found ${athletes.length} unlinked athletes`)

  let success = 0
  let failed = 0
  const failures = []

  for (const athlete of athletes) {
    try {
      const safeName = athlete.full_name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '.')
        .replace(/\.+/g, '.')
        .replace(/^\.|\.$/, '')
      const email = `${safeName}@peakathletics.app`
      const password = 'PeakAthlete2025!'

      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: athlete.full_name,
          role: 'athlete',
        },
      })

      if (authError) {
        if (authError.message?.includes('already been registered')) {
          console.log(`⚠ Skipped ${athlete.full_name} — email already exists`)
          failed++
          failures.push({ name: athlete.full_name, reason: 'email exists' })
          continue
        }
        throw authError
      }

      const userId = authData.user.id

      const { error: profileError } = await supabase.from('profiles').insert({
        id: userId,
        role: 'athlete',
        full_name: athlete.full_name,
        email,
        sport: athlete.sport || null,
        position: athlete.position || null,
        date_of_birth: athlete.date_of_birth || null,
        gender: athlete.gender || null,
        age_category: athlete.age_category || null,
        competition_level: athlete.competition_level || null,
      })
      if (profileError) throw profileError

      const { data: results, error: resultsError } = await supabase
        .from('roster_test_results')
        .select('*')
        .eq('full_name', athlete.full_name)
      if (resultsError) throw resultsError

      if (results && results.length > 0) {
        const mapped = results.map((r) => ({
          athlete_id: userId,
          category: r.category,
          test_type: r.test_type,
          value: r.value,
          unit: r.unit,
          higher_is_better: !LOWER_IS_BETTER.includes(r.test_type),
          date_tested: r.date_tested,
          migrated_from: 'roster_import_2025',
        }))

        for (let i = 0; i < mapped.length; i += 50) {
          const batch = mapped.slice(i, i + 50)
          const { error: insertError } = await supabase.from('pfa_test_results').insert(batch)
          if (insertError) throw insertError
        }
      }

      await supabase
        .from('athlete_roster')
        .update({ auth_linked: true })
        .eq('id', athlete.id)

      console.log(`✓ ${athlete.full_name} — ${results?.length || 0} results migrated`)
      success++

      await sleep(100)
    } catch (err) {
      console.error(`✗ ${athlete.full_name} — ${err.message}`)
      failed++
      failures.push({ name: athlete.full_name, reason: err.message })
    }
  }

  console.log('\n--- Migration Complete ---')
  console.log(`✓ Success: ${success}`)
  console.log(`✗ Failed: ${failed}`)

  if (failures.length > 0) {
    console.log('\nFailed athletes:')
    failures.forEach((f) => console.log(`  - ${f.name}: ${f.reason}`))
  }

  const { count: profileCount } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('role', 'athlete')

  const { count: resultsCount } = await supabase
    .from('pfa_test_results')
    .select('*', { count: 'exact', head: true })

  console.log(`\nDatabase totals:`)
  console.log(`  Athlete profiles: ${profileCount}`)
  console.log(`  Test results: ${resultsCount}`)
}

run().catch(console.error)
