const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')

const supabase = createClient(
  'https://iilysafrbbnklelzzqyh.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpbHlzYWZyYmJua2xlbHp6cXloIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDk5NTQ1NywiZXhwIjoyMDkwNTcxNDU3fQ.kxoF532EW9Sw81mxXucvc18bWBylKbTLbf-T4GEchkM'
)

// Normalize names for fuzzy matching
const normalizeName = (name) => {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

async function main() {
  // Load all profiles
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('role', 'athlete')

  if (error) {
    console.error('Failed to load profiles:', error)
    return
  }
  console.log(`Loaded ${profiles.length} athlete profiles`)

  // Build name lookup map
  const nameMap = {}
  for (const p of profiles) {
    nameMap[normalizeName(p.full_name)] = p.id
  }

  const FILES = [
    { file: 'nbu15aaa-skaters.json', league: 'NB U15 AAA', age_category: 'U15', type: 'skater' },
    { file: 'nbpeimu18hl-skaters.json', league: 'NBPEI Major U18', age_category: 'U18', type: 'skater' },
    { file: 'nbu15aaa-goalies.json', league: 'NB U15 AAA', age_category: 'U15', type: 'goalie' },
    { file: 'nbpeimu18hl-goalies.json', league: 'NBPEI Major U18', age_category: 'U18', type: 'goalie' },
  ]

  const unmatched = []
  const toInsert = []

  for (const source of FILES) {
    const raw = JSON.parse(fs.readFileSync(source.file, 'utf8'))

    // Filter out standings rows (they have no Player field)
    const players = raw.filter((r) => r.Player && r.Player.trim().length > 0)
    console.log(`\n${source.file}: ${players.length} players`)

    for (const row of players) {
      const normalizedName = normalizeName(row.Player)
      const athleteId = nameMap[normalizedName]

      if (!athleteId) {
        unmatched.push({ name: row.Player, league: source.league, file: source.file })
        continue
      }

      if (source.type === 'skater') {
        toInsert.push({
          athlete_id: athleteId,
          sport: 'Hockey',
          season: '2025-2026',
          team_name: row.Team,
          league: source.league,
          age_category: source.age_category,
          position: row.Pos || null,
          games_played: parseInt(row.GP) || 0,
          goals: parseInt(row.G) || 0,
          assists: parseInt(row.A) || 0,
          points: parseInt(row.PTS) || 0,
          ppg: parseInt(row.PPG) || 0,
          shg: parseInt(row.SHG) || 0,
          pim: parseInt(row.PIM) || 0,
          stats: {},
          source_url: source.file,
          scraped_at: new Date().toISOString(),
        })
      } else {
        // Goalie — store goalie-specific stats in jsonb
        toInsert.push({
          athlete_id: athleteId,
          sport: 'Hockey',
          season: '2025-2026',
          team_name: row.Team,
          league: source.league,
          age_category: source.age_category,
          position: 'G',
          games_played: (parseInt(row.W) || 0) + (parseInt(row.L) || 0),
          goals: 0,
          assists: 0,
          points: 0,
          ppg: 0,
          shg: 0,
          pim: 0,
          stats: {
            mins: parseFloat(row.MINS) || 0,
            wins: parseInt(row.W) || 0,
            losses: parseInt(row.L) || 0,
            goals_against: parseInt(row.GA) || 0,
            gaa: parseFloat(row.GAA) || 0,
            shots: parseInt(row.S) || 0,
            saves: parseInt(row.SV) || 0,
            save_pct: parseFloat(row['SV%']) || 0,
            shutouts: parseInt(row.SO) || 0,
          },
          source_url: source.file,
          scraped_at: new Date().toISOString(),
        })
      }
    }
  }

  console.log(`\nMatched: ${toInsert.length} players`)
  console.log(`Unmatched: ${unmatched.length} players`)
  fs.writeFileSync('unmatched-players.json', JSON.stringify(unmatched, null, 2))
  console.log('Unmatched saved to unmatched-players.json')

  if (toInsert.length > 0) {
    // Delete existing 2025-2026 hockey stats first to avoid duplicates
    await supabase
      .from('game_stats')
      .delete()
      .eq('season', '2025-2026')
      .eq('sport', 'Hockey')

    // Insert in batches of 50
    for (let i = 0; i < toInsert.length; i += 50) {
      const batch = toInsert.slice(i, i + 50)
      const { error: insertError } = await supabase
        .from('game_stats')
        .insert(batch)
      if (insertError) {
        console.error('Insert error:', insertError)
      } else {
        console.log(`Inserted batch ${Math.floor(i / 50) + 1}`)
      }
    }
    console.log('Import complete!')
  }
}

main().catch(console.error)
