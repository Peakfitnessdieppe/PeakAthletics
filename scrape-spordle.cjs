const puppeteer = require('puppeteer');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  'https://iilysafrbbnklelzzqyh.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpbHlzYWZyYmJua2xlbHp6cXloIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDk5NTQ1NywiZXhwIjoyMDkwNTcxNDU3fQ.kxoF532EW9Sw81mxXucvc18bWBylKbTLbf-T4GEchkM'
);

const normalizeName = (name) => name
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z\s]/g, '')
  .replace(/\s+/g, ' ')
  .trim();

const GRAYJAY_SITES = [
  {
    name: 'nbu15aaa',
    url: 'https://www.nbu15aaa.ca/stats/',
    league: 'NBU15AAAHL',
    seasons: ['2025-2026', '2024-2025'],
    gameTypes: ['Regular Season', 'Playoffs'],
  },
  {
    name: 'nbpeimu18hl',
    url: 'https://nbpeimu18hl.ca/stats/',
    league: 'NBPEIMU18HL',
    seasons: ['2025-2026', '2024-2025'],
    gameTypes: ['Regular Season', 'Playoffs', 'Exhibition'],
  },
];

const ATHLETE_EP_URLS = [
  { name: 'Marc MacPhee', url: 'https://www.eliteprospects.com/player/972021/marc-macphee' },
  { name: 'Alexandre LeBlanc', url: 'https://www.eliteprospects.com/player/1130200/alexandre-leblanc' },
  { name: 'Mathis Theriault', url: 'https://www.eliteprospects.com/player/1128644/mathis-theriault' },
  { name: 'Dexter McLaughlin', url: 'https://www.eliteprospects.com/player/1220810/dexter-mclaughlin' },
  { name: 'Xavier LeBlanc', url: 'https://www.eliteprospects.com/player/940308/xavier-leblanc' },
  { name: 'Dominic Cormier', url: 'https://www.eliteprospects.com/player/965929/dominic-cormier' },
  { name: 'Mattéo Bélanger', url: 'https://www.eliteprospects.com/player/1002326/matteo-belanger' },
  { name: 'Kian Daigle', url: 'https://www.eliteprospects.com/player/1130165/kian-daigle' },
  { name: 'Kaleb LeBlanc', url: 'https://www.eliteprospects.com/player/1130152/kaleb-leblanc' },
  { name: 'Nikolas Melanson', url: 'https://www.eliteprospects.com/player/1130186/nikolas-melanson' },
  { name: 'Dallas Hamilton', url: 'https://www.eliteprospects.com/player/1128641/dallas-hamilton' },
  { name: 'Caleb Boudreau', url: 'https://www.eliteprospects.com/player/1130157/caleb-boudreau' },
];

// key = athleteId|season|league|gameType — keeps highest GP per combination
const allStats = {};
let loggedSelectDiagnostics = false;

function upsertStat(athleteId, record) {
  const key = `${athleteId}|${record.season}|${record.league}|${record.game_type}`;
  const existing = allStats[key];
  if (!existing || record.games_played > (existing.games_played || 0)) {
    allStats[key] = { ...record, athlete_id: athleteId };
    return true;
  }
  return false;
}

async function selectSeasonAndType(page, siteUrl, seasonText, gameType) {
  await page.goto(siteUrl, { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise(r => setTimeout(r, 3000));

  // Find the season_filter select and get the option value matching seasonText
  const seasonValue = await page.evaluate((text) => {
    const sel = document.getElementById('season_filter');
    if (!sel) return null;
    const opt = Array.from(sel.options).find(o => o.text.trim() === text);
    return opt ? opt.value : null;
  }, seasonText);

  if (!seasonValue) {
    console.log(`    Season "${seasonText}" not found in dropdown — skipping`);
    return false;
  }

  // Select the season by numeric value
  await page.select('#season_filter', seasonValue);
  await new Promise(r => setTimeout(r, 2500));

  // Now find the subseason (game type) option value
  const subseasonValue = await page.evaluate((text) => {
    const sel = document.getElementById('subseason_filter');
    if (!sel) return null;
    // Get the FIRST option matching this game type text (belongs to selected season)
    const opt = Array.from(sel.options).find(o => o.text.trim() === text);
    return opt ? opt.value : null;
  }, gameType);

  if (!subseasonValue) {
    console.log(`    Game type "${gameType}" not found — skipping`);
    return false;
  }

  // Select the subseason
  await page.select('#subseason_filter', subseasonValue);
  await new Promise(r => setTimeout(r, 2500));

  // Submit/apply the filter — look for a filter button or form submit
  try {
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button, input[type=submit]'))
        .find(el => /filter|search|go|apply/i.test(el.innerText || el.value));
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 2000));
  } catch(e) {}

  return true;
}

async function scrapeCurrentTable(page, season, league, gameType) {
  const normalizedSeason = season.replace(/(\d{4})-(\d{2})(\d{2})/, '$1-$3');

  const skaters = await page.evaluate(() => {
    const results = [];
    document.querySelectorAll('table').forEach(table => {
      const headers = Array.from(table.querySelectorAll('th')).map(th => th.innerText.trim());
      if (!headers.includes('PTS') || !headers.includes('GP') || !headers.includes('Player')) return;
      table.querySelectorAll('tbody tr').forEach(row => {
        const cells = Array.from(row.querySelectorAll('td')).map(td => td.innerText.trim());
        if (cells.length < 5) return;
        const obj = {};
        headers.forEach((h, i) => { obj[h] = cells[i] || ''; });
        if (obj['Player'] && obj['Player'].length > 1 && parseInt(obj['GP']) > 0) results.push(obj);
      });
    });
    return results;
  });

  const goalies = await page.evaluate(() => {
    const results = [];
    document.querySelectorAll('table').forEach(table => {
      const headers = Array.from(table.querySelectorAll('th')).map(th => th.innerText.trim());
      if (!headers.includes('GAA') || !headers.includes('Player')) return;
      table.querySelectorAll('tbody tr').forEach(row => {
        const cells = Array.from(row.querySelectorAll('td')).map(td => td.innerText.trim());
        if (cells.length < 5) return;
        const obj = {};
        headers.forEach((h, i) => { obj[h] = cells[i] || ''; });
        const gp = (parseInt(obj['W']) || 0) + (parseInt(obj['L']) || 0);
        if (obj['Player'] && obj['Player'].length > 1 && gp > 0) results.push(obj);
      });
    });
    return results;
  });

  const mapped = [
    ...skaters.map(r => ({
      playerName: r['Player'],
      teamName: r['Team'] || '',
      season: normalizedSeason,
      league,
      game_type: gameType,
      position: r['Pos'] || null,
      games_played: parseInt(r['GP']) || 0,
      goals: parseInt(r['G']) || 0,
      assists: parseInt(r['A']) || 0,
      points: parseInt(r['PTS']) || 0,
      ppg: parseInt(r['PPG']) || 0,
      shg: parseInt(r['SHG']) || 0,
      pim: parseInt(r['PIM']) || 0,
      stats: {},
    })),
    ...goalies.map(r => ({
      playerName: r['Player'],
      teamName: r['Team'] || '',
      season: normalizedSeason,
      league,
      game_type: gameType,
      position: 'G',
      games_played: (parseInt(r['W']) || 0) + (parseInt(r['L']) || 0),
      goals: 0, assists: 0, points: 0, ppg: 0, shg: 0, pim: 0,
      stats: {
        mins: parseFloat(r['MINS']) || 0,
        wins: parseInt(r['W']) || 0,
        losses: parseInt(r['L']) || 0,
        goals_against: parseInt(r['GA']) || 0,
        gaa: parseFloat(r['GAA']) || 0,
        shots: parseInt(r['S']) || 0,
        saves: parseInt(r['SV']) || 0,
        save_pct: parseFloat(r['SV%']) || 0,
        shutouts: parseInt(r['SO']) || 0,
      },
    })),
  ];

  return mapped;
}

async function scrapeEPCareer(page, entry) {
  try {
    await page.goto(entry.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  } catch(e) {}

  await new Promise(r => setTimeout(r, 4000));

  await page.evaluate(async () => {
    await new Promise(resolve => {
      let h = 0;
      const t = setInterval(() => {
        window.scrollBy(0, 300);
        h += 300;
        if (h >= 3000) { clearInterval(t); resolve(); }
      }, 200);
    });
  });

  await new Promise(r => setTimeout(r, 3000));

  return await page.evaluate(() => {
    const stats = [];
    document.querySelectorAll('table').forEach(table => {
      const rows = Array.from(table.querySelectorAll('tr'));
      if (rows.length < 2) return;
      const headers = Array.from(rows[0].querySelectorAll('th, td')).map(h => h.innerText.trim());
      if (!headers.some(h => h === 'Season' || h === 'S') || !headers.some(h => h === 'GP')) return;

      for (let i = 1; i < rows.length; i++) {
        const cells = Array.from(rows[i].querySelectorAll('td')).map(td => td.innerText.trim());
        if (cells.length < 4) continue;
        const obj = {};
        headers.forEach((h, idx) => { obj[h] = cells[idx] || ''; });
        const season = obj['Season'] || obj['S'] || '';
        if (!season.match(/\d{4}/)) continue;
        if (parseInt(obj['GP']) === 0) continue;
        stats.push({
          season,
          team: obj['Team'] || '',
          league: obj['League'] || '',
          gp: obj['GP'] || '0',
          g: obj['G'] || '0',
          a: obj['A'] || '0',
          pts: obj['TP'] || obj['PTS'] || '0',
          pim: obj['PIM'] || '0',
          gaa: obj['GAA'] || null,
          svpct: obj['SV%'] || null,
        });
      }
    });
    return stats;
  });
}

async function main() {
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('role', 'athlete');

  const profileMap = {};
  for (const p of profiles) {
    profileMap[normalizeName(p.full_name)] = p;
  }

  const browser = await puppeteer.launch({ headless: false, slowMo: 30 });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  // PHASE 1: GrayJay — all seasons, all game types
  console.log('\n=== PHASE 1: GrayJay all seasons ===');
  for (const site of GRAYJAY_SITES) {
    console.log(`\nSite: ${site.league}`);
    for (const season of site.seasons) {
      for (const gameType of site.gameTypes) {
        console.log(`  ${season} — ${gameType}`);
        const success = await selectSeasonAndType(page, site.url, season, gameType);
        if (!success) continue;
        const rows = await scrapeCurrentTable(page, season, site.league, gameType);
        let matched = 0;
        for (const row of rows) {
          const profile = profileMap[normalizeName(row.playerName)];
          if (!profile) continue;
          const kept = upsertStat(profile.id, { ...row, source_url: site.url });
          if (kept) matched++;
        }
        console.log(`    Found ${rows.length} players, ${matched} matched to athletes`);
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  }

  // PHASE 2: EP career history
  console.log('\n=== PHASE 2: EliteProspects career history ===');
  for (const entry of ATHLETE_EP_URLS) {
    const profile = profileMap[normalizeName(entry.name)];
    if (!profile) { console.log(`✗ Not in DB: ${entry.name}`); continue; }

    console.log(`\nEP: ${entry.name}`);
    const epStats = await scrapeEPCareer(page, entry);

    for (const row of epStats) {
      const isGoalie = row.gaa !== null && row.gaa !== '';
      const record = {
        playerName: entry.name,
        teamName: row.team,
        season: row.season,
        league: row.league,
        game_type: 'Regular Season',
        position: isGoalie ? 'G' : null,
        games_played: parseInt(row.gp) || 0,
        goals: parseInt(row.g) || 0,
        assists: parseInt(row.a) || 0,
        points: parseInt(row.pts) || 0,
        ppg: 0, shg: 0,
        pim: parseInt(row.pim) || 0,
        stats: isGoalie ? { gaa: parseFloat(row.gaa), save_pct: parseFloat(row.svpct) } : {},
        source_url: entry.url,
      };
      const kept = upsertStat(profile.id, record);
      if (kept) console.log(`  + EP: ${row.season} | ${row.league} | ${row.team} | ${row.gp}GP`);
    }
    await new Promise(r => setTimeout(r, 4000));
  }

  // PHASE 3: Write deduplicated stats to Supabase
  console.log('\n=== PHASE 3: Writing to Supabase ===');
  await supabase.from('game_stats').delete().eq('sport', 'Hockey');
  console.log('Cleared existing hockey stats');

  const records = Object.values(allStats);
  console.log(`Inserting ${records.length} deduplicated records...`);

  for (let i = 0; i < records.length; i += 50) {
    const batch = records.slice(i, i + 50).map(r => ({
      athlete_id: r.athlete_id,
      sport: 'Hockey',
      season: r.season,
      team_name: r.teamName,
      league: r.league || '',
      age_category: null,
      position: r.position || null,
      game_type: r.game_type || 'Regular Season',
      games_played: r.games_played,
      goals: r.goals,
      assists: r.assists,
      points: r.points,
      ppg: r.ppg || 0,
      shg: r.shg || 0,
      pim: r.pim || 0,
      stats: r.stats || {},
      source_url: r.source_url,
      scraped_at: new Date().toISOString(),
    }));

    const { error } = await supabase.from('game_stats').upsert(batch, {
      onConflict: 'athlete_id,league,season,game_type',
      ignoreDuplicates: false
    });
    if (error) console.log(`Batch error:`, error.message);
    else console.log(`Inserted batch ${Math.floor(i/50)+1} (${batch.length} records)`);
  }

  fs.writeFileSync('career-stats-final.json', JSON.stringify(records, null, 2));
  console.log(`\nDone. ${records.length} unique records imported.`);
  await browser.close();
}

main().catch(console.error);
