const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' }
  }

  try {
    const { athleteId, force } = JSON.parse(event.body)
    if (!athleteId) return { statusCode: 400, body: JSON.stringify({ error: 'Missing athleteId' }) }

    // Fetch athlete profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', athleteId)
      .single()

    if (!profile) return { statusCode: 404, body: JSON.stringify({ error: 'Athlete not found' }) }

    // Fetch composite scores
    const { data: compScore } = await supabase
      .from('pfa_composite_scores')
      .select('*')
      .eq('athlete_id', athleteId)
      .single()

    // Check cache — skip regeneration if insights exist and scores haven't changed
    if (!force && compScore) {
      const { data: cached } = await supabase
        .from('pfa_ai_insights')
        .select('insight_json, generated_at')
        .eq('athlete_id', athleteId)
        .single()

      if (cached && cached.generated_at > compScore.calculated_at) {
        console.log('Returning cached insights for', athleteId)
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ insight: cached.insight_json, cached: true })
        }
      }
    }

    // Fetch test results
    const { data: results } = await supabase
      .from('pfa_test_results')
      .select('*, load_value, reps, relative_strength')
      .eq('athlete_id', athleteId)
      .order('date_tested', { ascending: false })

    // Fetch peer averages filtered by gender + age_category
    const { data: peerProfiles } = await supabase
      .from('profiles')
      .select('id')
      .eq('gender', profile.gender)
      .eq('age_category', profile.age_category)
      .eq('role', 'athlete')
      .neq('id', athleteId)

    const peerIds = (peerProfiles || []).map(p => p.id)

    const { data: peerScores } = await supabase
      .from('pfa_composite_scores')
      .select('speed_score, strength_score, power_score, agility_score, endurance_score')
      .in('athlete_id', peerIds)

    const avg = (arr, key) => arr.length ? (arr.reduce((s, r) => s + (r[key] || 0), 0) / arr.length).toFixed(1) : 'N/A'
    const peerAvg = {
      speed: avg(peerScores || [], 'speed_score'),
      strength: avg(peerScores || [], 'strength_score'),
      power: avg(peerScores || [], 'power_score'),
      agility: avg(peerScores || [], 'agility_score'),
      endurance: avg(peerScores || [], 'endurance_score'),
    }

    // Fetch game stats
    const { data: gameStats } = await supabase
      .from('game_stats')
      .select('*')
      .eq('athlete_id', athleteId)
      .eq('sport', profile.sport)
      .order('season', { ascending: false })

    // Build best results per test
    const strengthTests = ['squat', 'bench_press', 'trap_bar_deadlift']
    const calcE1RM = (load, reps) => (!load || !reps || reps === 1) ? load : Math.round(load * (1 + reps / 30))
    const bestResults = {}
    for (const r of results || []) {
      if (!bestResults[r.test_type]) bestResults[r.test_type] = r
    }

    const formatResult = (test, r) => {
      if (!r) return '—'
      if (strengthTests.includes(test)) {
        const e1rm = calcE1RM(r.load_value, r.reps) || Math.round(r.value)
        const rel = r.relative_strength ? ` | Relative: ${Number(r.relative_strength).toFixed(2)}x BW` : ''
        return `${e1rm} lbs e1RM (${r.load_value} lbs x ${r.reps} reps)${rel}` 
      }
      return `${r.value} ${r.unit || ''}` 
    }

    const resultsSummary = Object.entries(bestResults)
      .map(([test, r]) => `${test}: ${formatResult(test, r)}`)
      .join('\n')

    const gameContext = (gameStats || []).length > 0
      ? gameStats.slice(0, 3).map(gs =>
          `${gs.season} ${gs.league}: ${gs.games_played}GP ${gs.goals ?? ''}G ${gs.assists ?? ''}A ${gs.points ?? ''}PTS` 
        ).join('\n')
      : 'No game stats available'

    const firstName = profile.full_name?.split(' ')[0] || 'This athlete'
    const pronoun = profile.gender === 'female' ? 'her' : 'his'
    const pronounCap = profile.gender === 'female' ? 'Her' : 'His'

    const prompt = `You are PeakIQ, the performance intelligence system for Peak Fitness Athletics in Dieppe, NB, Canada. You specialize in youth athlete development for hockey and other sports.

IMPORTANT RULES:
- All strength values are in POUNDS (lbs). Never convert or change units.
- Write for PARENTS first — warm, clear, proud, plain English. No jargon.
- Use the athlete's first name (${firstName}) throughout.
- Use pronouns: ${pronoun} / ${pronounCap}
- Be specific — reference actual numbers and test results.
- Frame development areas as training priorities, not weaknesses.
- Connect physical results to sport performance (${profile.sport}).

ATHLETE: ${profile.full_name}
Sport: ${profile.sport} | Position: ${profile.position || 'N/A'} | Age Group: ${profile.age_category} | Level: ${profile.competition_level || 'N/A'} | Gender: ${profile.gender}

COMPOSITE SCORES (0-100, relative to ${profile.gender} ${profile.age_category} peers):
Overall: ${compScore?.overall_score || 'N/A'}
Speed: ${compScore?.speed_score || 'N/A'} (peer avg: ${peerAvg.speed})
Strength: ${compScore?.strength_score || 'N/A'} (peer avg: ${peerAvg.strength})
Power: ${compScore?.power_score || 'N/A'} (peer avg: ${peerAvg.power})
Agility: ${compScore?.agility_score || 'N/A'} (peer avg: ${peerAvg.agility})
Endurance: ${compScore?.endurance_score || 'N/A'} (peer avg: ${peerAvg.endurance})

TEST RESULTS (personal bests):
${resultsSummary}

GAME STATISTICS (${profile.sport}):
${gameContext}

Generate a JSON object with EXACTLY these keys. No markdown, no backticks, no extra text — just raw JSON:

{
  "this_season": "2-3 sentences that tell the story of this athlete's development season. Lead with their most impressive physical gains using real numbers. If game stats exist, weave them in as proof the physical development is translating. If no game stats exist, focus purely on the physical trajectory and what the numbers mean. Warm, proud, narrative tone — this is the first thing a parent reads.",

  "speed_insight": "One sentence about speed for parents. Reference actual sprint time. Connect to sport if above average.",
  "strength_insight": "One sentence about overall strength for parents. Reference the standout lift.",
  "squat_insight": "One sentence about squat specifically. Reference e1RM and relative strength if impressive. Only generate if squat data exists.",
  "bench_press_insight": "One sentence about bench press specifically. Reference e1RM. Only generate if bench press data exists.",
  "trap_bar_insight": "One sentence about trap bar deadlift specifically. Reference e1RM and relative strength. Only generate if trap bar data exists.",
  "pull_ups_insight": "One sentence about pull ups if data exists. Otherwise omit this key.",
  "push_ups_insight": "One sentence about push ups if data exists. Otherwise omit this key.",
  "power_insight": "One sentence about overall explosive power for parents.",
  "vertical_jump_insight": "One sentence about vertical jump specifically. Only generate if vertical jump data exists.",
  "broad_jump_insight": "One sentence about broad jump specifically. Reference the measurement and what it means athletically. Only generate if broad jump data exists.",
  "mb_chest_pass_insight": "One sentence about medicine ball chest pass if data exists. Otherwise omit this key.",
  "agility_insight": "One sentence about agility for parents. Reference shuttle time.",
  "endurance_insight": "One sentence about endurance for parents. Reference beep test level.",

  "physical_standouts": "2-3 sentences highlighting the athlete's most impressive absolute numbers with peer context. Be specific — name the exact numbers and what they mean relative to other athletes tested. This is what parents screenshot and share. Make every word earn its place.",

  "what_to_watch_for": "2-3 sentences giving parents something specific to observe at the next game or practice that directly reflects the training. Connect gym metrics to observable on-field/ice behaviors. Use language parents can actually use when talking to coaches. Sport-specific.",

  "whats_working": "2-3 sentences celebrating standout physical qualities. Warm, proud tone. Specific numbers. This is what parents will screenshot.",
  "where_focused": "2-3 sentences about training priorities framed positively. Use 'we are working with [first name] on...' framing. Never frame as weaknesses.",
  "on_the_ice": "2-3 sentences connecting physical development to sport performance. How do the physical gains show up in the game? Sport-specific language.",
  "next_steps": "1-2 sentences about what we are building toward and what improvement we are targeting in the next testing session."
}

Every value must be a single string. No nested objects. No arrays. No line breaks within values. If a test result does not exist for a specific insight key, omit that key entirely from the JSON rather than returning an empty string or placeholder.`

    console.log('Calling OpenAI for athlete:', athleteId)

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1200,
        temperature: 0.7,
        response_format: { type: 'json_object' }
      }),
    })

    if (!openaiRes.ok) {
      const err = await openaiRes.text()
      console.error('OpenAI error:', err)
      return { statusCode: 500, body: JSON.stringify({ error: 'OpenAI request failed', detail: err }) }
    }

    const openaiData = await openaiRes.json()
    const rawContent = openaiData.choices?.[0]?.message?.content || '{}'
    
    let insightJson
    try {
      insightJson = JSON.parse(rawContent)
    } catch (parseErr) {
      console.error('JSON parse error:', parseErr, 'Raw:', rawContent)
      return { statusCode: 500, body: JSON.stringify({ error: 'Failed to parse AI response' }) }
    }

    // Cache in pfa_ai_insights table
    const { error: upsertError } = await supabase
      .from('pfa_ai_insights')
      .upsert({
        athlete_id: athleteId,
        insight_json: insightJson,
        generated_at: new Date().toISOString()
      }, { onConflict: 'athlete_id' })

    if (upsertError) {
      console.error('Cache upsert error:', upsertError)
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ insight: insightJson, cached: false })
    }

  } catch (err) {
    console.error('generate-analytics error:', err.message, err.stack)
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}
