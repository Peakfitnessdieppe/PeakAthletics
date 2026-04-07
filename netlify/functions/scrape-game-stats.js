const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const LEAGUE_SOURCES = [
  {
    name: 'NB U15 AAA',
    url: 'https://www.nbu15aaa.ca/api/league/stats/?season_id=2962&subseason_id=16446',
    league: 'NB U15 AAA',
    age_category: 'U15',
    sport: 'Hockey',
  },
]

const normalizePlayerName = (first, last) => `${first.trim()} ${last.trim()}`.toLowerCase().replace(/\s+/g, ' ')

exports.handler = async () => {
  try {
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, full_name, sport, age_category')
      .eq('role', 'athlete')

    if (profileError) throw profileError

    const nameMap = {}
    for (const p of profiles || []) {
      const key = (p.full_name || '').toLowerCase().replace(/\s+/g, ' ').trim()
      if (key) nameMap[key] = p.id
    }

    let totalMatched = 0
    let totalUnmatched = 0
    const unmatched = []

    for (const source of LEAGUE_SOURCES) {
      console.log(`Fetching ${source.name}...`)

      const res = await fetch(source.url)
      if (!res.ok) {
        console.error(`Failed to fetch ${source.name}: ${res.status}`)
        continue
      }

      const json = await res.json()
      const players = json.data || []

      for (const player of players) {
        const fullName = normalizePlayerName(player.player_first_name, player.player_last_name)
        const athleteId = nameMap[fullName]

        if (!athleteId) {
          totalUnmatched++
          unmatched.push(`${player.player_first_name.trim()} ${player.player_last_name.trim()} (${source.name})`)
          continue
        }

        const { error } = await supabase
          .from('game_stats')
          .upsert(
            {
              athlete_id: athleteId,
              league: source.league,
              season: '2025-2026',
              sport: source.sport,
              age_category: source.age_category,
              team_name: player.team_name,
              games_played: player.gp,
              goals: player.goals,
              assists: player.assists,
              points: player.points,
              ppg: player.ppg,
              shg: player.shg,
              pim: player.pims,
              position: player.position_short_name,
              scraped_at: new Date().toISOString(),
            },
            {
              onConflict: 'athlete_id,league,season',
            }
          )

        if (error) {
          console.error(`Failed to upsert ${fullName}:`, error.message)
        } else {
          totalMatched++
        }
      }

      console.log(`${source.name}: done`)
    }

    console.log(`\nTotal matched: ${totalMatched}`)
    console.log(`Total unmatched: ${totalUnmatched}`)
    if (unmatched.length > 0) {
      console.log('Unmatched players:')
      unmatched.forEach((n) => console.log(' -', n))
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, matched: totalMatched, unmatched: totalUnmatched, unmatchedPlayers: unmatched }),
    }
  } catch (err) {
    console.error('Scraper error:', err)
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: err.message }),
    }
  }
}
