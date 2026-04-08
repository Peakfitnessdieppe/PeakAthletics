import { createClient } from '@supabase/supabase-js'
import * as cheerio from 'cheerio'

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const normalizeName = (name) =>
  name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

const scrapeGrayJay = async (source) => {
  const res = await fetch(source.url)
  const json = await res.json()
  return (json.data || []).map((p) => ({
    full_name: `${p.player_first_name.trim()} ${p.player_last_name.trim()}`,
    team_name: p.team_name,
    gp: p.gp,
    goals: p.goals,
    assists: p.assists,
    points: p.points,
    ppg: p.ppg || 0,
    shg: p.shg || 0,
    pim: p.pims || 0,
    position: p.position_short_name,
  }))
}

const scrapeFloatingAction = async (source) => {
  const res = await fetch(source.url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
    },
  })
  const html = await res.text()
  const $ = cheerio.load(html)

  console.log(`  Tables found: ${$('table').length}`)
  console.log(`  Rows in first table: ${$('table').first().find('tr').length}`)
  console.log(`  First row text: ${$('table').first().find('tr').first().text().trim().substring(0, 100)}`)

  const players = []

  $('table tr').each((i, row) => {
    const cells = $(row).find('td')
    if (cells.length < 4) return
    const nameCell = $(cells[0]).text().trim()
    if (!nameCell || nameCell === 'Player' || nameCell === 'Name') return
    const gp = parseInt($(cells[1]).text().trim())
    const goals = parseInt($(cells[2]).text().trim())
    const assists = parseInt($(cells[3]).text().trim())
    const points = parseInt($(cells[4]).text().trim()) || goals + assists
    if (nameCell && !isNaN(gp) && gp > 0) {
      players.push({ full_name: nameCell, team_name: '', gp, goals, assists, points, ppg: 0, shg: 0, pim: 0, position: '' })
    }
  })

  if (players.length === 0) {
    console.log(`  No players found. HTML snippet:`)
    console.log(html.substring(0, 2000))
  }

  return players
}

const scrapeThunderbirds = async (source) => {
  const res = await fetch(source.url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  const html = await res.text()
  const $ = cheerio.load(html)
  const players = []
  $('table tbody tr').each((i, row) => {
    const cells = $(row).find('td')
    if (cells.length < 5) return
    const name = $(cells[0]).text().replace(/,.*$/, '').trim()
    const team = $(cells[1]).text().trim()
    const gp = parseInt($(cells[2]).text()) || 0
    const goals = parseInt($(cells[3]).text()) || 0
    const assists = parseInt($(cells[4]).text()) || 0
    const points = parseInt($(cells[5]).text()) || goals + assists
    if (name && gp > 0)
      players.push({ full_name: name, team_name: team, gp, goals, assists, points, ppg: 0, shg: 0, pim: 0, position: '' })
  })
  return players
}

const scrapeNHL = async (source) => {
  const url = `https://api-web.nhle.com/v1/player/${source.nhlPlayerId}/landing`
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  const data = await res.json()

  const currentSeason = data.seasonTotals?.find(
    (s) => s.season === 20252026 && s.gameTypeId === 2 && s.leagueAbbrev === 'NHL'
  )
  if (!currentSeason) return []

  return [
    {
      full_name: source.full_name,
      team_name: data.currentTeamAbbrev || 'TOR',
      gp: currentSeason.gamesPlayed || 0,
      goals: currentSeason.goals || 0,
      assists: currentSeason.assists || 0,
      points: currentSeason.points || 0,
      ppg: currentSeason.powerPlayGoals || 0,
      shg: currentSeason.shorthandedGoals || 0,
      pim: currentSeason.pim || 0,
      position: data.position || 'D',
    },
  ]
}

const SOURCES = [
  {
    name: 'NB U15 AAA',
    url: 'https://www.nbu15aaa.ca/api/league/stats/?season_id=2962&subseason_id=16446',
    league: 'NB U15 AAA',
    age_category: 'U15',
    sport: 'Hockey',
    scraper: scrapeGrayJay,
  },
  {
    name: 'NB U14 AAA',
    url: 'https://www.nbu14aaa.ca/api/league/stats/?season_id=2961&subseason_id=16441',
    league: 'NB U14 AAA',
    age_category: 'U14',
    sport: 'Hockey',
    scraper: scrapeGrayJay,
  },
  {
    name: 'NBPEI U18 MHL',
    url: 'https://nbpeimu18hl.ca/api/league/stats/?season_id=2630&subseason_id=14630',
    league: 'NBPEI U18 MHL',
    age_category: 'U18',
    sport: 'Hockey',
    scraper: scrapeGrayJay,
  },
  {
    name: 'NSU16 Thunderbirds',
    url: 'https://www.thunderbirds.nsu16aaahl.ca/stats.php',
    league: 'NSU16 AAA',
    age_category: 'U16',
    sport: 'Hockey',
    scraper: scrapeThunderbirds,
  },
  {
    name: 'NHL - Philippe Myers',
    nhlPlayerId: '8479026',
    full_name: 'Philippe Myers',
    league: 'NHL',
    age_category: 'Senior',
    sport: 'Hockey',
    scraper: scrapeNHL,
  },
]

const runScraper = async () => {
  console.log('Starting game stats scraper:', new Date().toISOString())

  const { data: profiles } = await supabase.from('profiles').select('id, full_name').eq('role', 'athlete')

  const nameMap = {}
  for (const p of profiles || []) {
    nameMap[normalizeName(p.full_name)] = { id: p.id, full_name: p.full_name }
  }

  let totalMatched = 0
  let totalUnmatched = 0
  const allUnmatched = []

  for (const source of SOURCES) {
    console.log(`Scraping ${source.name}...`)
    let players = []
    try {
      players = await source.scraper(source)
      console.log(`  Found ${players.length} players`)
    } catch (err) {
      console.error(`  Failed: ${err.message}`)
      continue
    }

    for (const player of players) {
      const key = normalizeName(player.full_name)
      const match = nameMap[key]
      if (!match) {
        totalUnmatched++
        allUnmatched.push(`${player.full_name} (${source.name})`)
        continue
      }

      const { error } = await supabase
        .from('game_stats')
        .upsert(
          {
            athlete_id: match.id,
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
            pim: player.pim,
            position: player.position,
            scraped_at: new Date().toISOString(),
          },
          { onConflict: 'athlete_id,league,season' }
        )

      if (error) {
        console.error(`  DB error for ${player.full_name}:`, error.message)
      } else {
        totalMatched++
        console.log(`  ✓ ${match.full_name}`)
      }

      await sleep(50)
    }
  }

  await supabase
    .from('analytics_cache')
    .upsert(
      {
        key: 'last_scrape_run',
        value: JSON.stringify({
          ran_at: new Date().toISOString(),
          matched: totalMatched,
          unmatched: totalUnmatched,
          unmatched_players: allUnmatched,
        }),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' }
    )

  console.log(`\nDone. Matched: ${totalMatched}, Unmatched: ${totalUnmatched}`)
  if (allUnmatched.length) {
    console.log('Unmatched:', allUnmatched)
  }
}

export const handler = async () => {
  await runScraper()
  return { statusCode: 202 }
}

export const config = {
  schedule: '0 4 * * *', // 4am UTC ≈ midnight Atlantic
}
