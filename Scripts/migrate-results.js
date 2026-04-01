import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { parse } from 'csv-parse/sync'
import { createClient } from '@supabase/supabase-js'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const FILES = [
  { file: 'speed_results.csv', category: 'speed' },
  { file: 'strength_results.csv', category: 'strength' },
  { file: 'strength_reps.csv', category: 'strength' },
  { file: 'power_results.csv', category: 'power' },
  { file: 'power_results_2.csv', category: 'power' },
  { file: 'agility_results.csv', category: 'agility' },
  { file: 'endurance_results.csv', category: 'endurance' },
]

const batchInsert = async (rows) => {
  for (let i = 0; i < rows.length; i += 50) {
    const batch = rows.slice(i, i + 50)
    const { error } = await supabase.from('roster_test_results').insert(batch)
    if (error) {
      console.error('Insert error:', error.message)
      console.error('Failed batch sample:', batch[0])
    }
  }
}

const run = async () => {
  for (const { file, category } of FILES) {
    const filePath = path.join(__dirname, 'data', file)
    if (!fs.existsSync(filePath)) {
      console.log(`Skipping ${file} — not found`)
      continue
    }
    const content = fs.readFileSync(filePath, 'utf8')
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      cast: true,
    })

    const rows = records
      .map((r) => ({
        full_name: r.full_name,
        category: r.category || category,
        test_type: r.test_type,
        value: typeof r.value === 'string' ? parseFloat(r.value) : r.value,
        unit: r.unit,
        date_tested: r.date_tested || null,
      }))
      .filter((r) => r.full_name && r.test_type && !Number.isNaN(r.value))

    console.log(`Inserting ${rows.length} rows from ${file}...`)
    await batchInsert(rows)
    console.log(`Inserted ${rows.length} rows from ${file}`)
  }
  console.log('Migration complete.')
}

run().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
