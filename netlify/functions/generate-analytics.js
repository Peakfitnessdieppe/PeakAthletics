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
      .eq('sport', profile.sport)
      .eq('role', 'athlete')
      .neq('id', athleteId)

    const peerIds = (peerProfiles || []).map(p => p.id)

    const { data: peerScores } = await supabase
      .from('pfa_composite_scores')
      .select('speed_score, strength_score, power_score, agility_score, endurance_score')
      .in('athlete_id', peerIds)
      .eq('sport', profile.sport)

    const { data: peerTestResults } = await supabase
      .from('pfa_test_results')
      .select('athlete_id, test_type, value, load_value, reps')
      .in('athlete_id', peerIds)
      .eq('sport', profile.sport)

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

    const calcE1RM = (load, reps) => (!load || !reps || reps === 1) ? load : Math.round(load * (1 + reps / 30))
    const LOWER_IS_BETTER = ['10m_sprint', 'pro_agility_shuttle']
    const STRENGTH_TESTS = ['squat', 'bench_press', 'trap_bar_deadlift']

    // Get best value per athlete per test from peer results
    const peerBestByTest = {}
    for (const r of (peerTestResults || [])) {
      const val = STRENGTH_TESTS.includes(r.test_type) 
        ? calcE1RM(r.load_value, r.reps) 
        : r.value
      if (!val) continue
      if (!peerBestByTest[r.test_type]) peerBestByTest[r.test_type] = {}
      const current = peerBestByTest[r.test_type][r.athlete_id]
      const isBetter = LOWER_IS_BETTER.includes(r.test_type) 
        ? (!current || val < current) 
        : (!current || val > current)
      if (isBetter) peerBestByTest[r.test_type][r.athlete_id] = val
    }

    // Get athlete's best per test
    const athleteBestByTest = {}
    for (const r of (results || [])) {
      const val = STRENGTH_TESTS.includes(r.test_type)
        ? calcE1RM(r.load_value, r.reps)
        : r.value
      if (!val) continue
      const current = athleteBestByTest[r.test_type]
      const isBetter = LOWER_IS_BETTER.includes(r.test_type)
        ? (!current || val < current)
        : (!current || val > current)
      if (isBetter) athleteBestByTest[r.test_type] = val
    }

    // Calculate rank for each test
    const rankings = {}
    for (const [testType, athleteVal] of Object.entries(athleteBestByTest)) {
      const peerVals = Object.values(peerBestByTest[testType] || {})
      const allVals = [...peerVals, athleteVal]
      allVals.sort((a, b) => LOWER_IS_BETTER.includes(testType) ? a - b : b - a)
      const rank = allVals.indexOf(athleteVal) + 1
      const total = allVals.length
      rankings[testType] = { rank, total, value: athleteVal }
    }

    // Build ranking summary string for prompt
    const rankingSummary = Object.entries(rankings)
      .map(([test, r]) => {
        const label = test.replaceAll('_', ' ')
        return `${label}: ranks ${r.rank} of ${r.total} (value: ${r.value})` 
      })
      .join('\n')

    // Build best results per test
    const strengthTests = ['squat', 'bench_press', 'trap_bar_deadlift']
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

    const sportContext = {
      Hockey: { surface: 'ice', venue: 'rink', action: 'skating', object: 'puck' },
      Soccer: { surface: 'pitch', venue: 'field', action: 'running', object: 'ball' },
      Ringette: { surface: 'ice', venue: 'rink', action: 'skating', object: 'ring' },
      Volleyball: { surface: 'court', venue: 'gym', action: 'moving', object: 'ball' },
      Basketball: { surface: 'court', venue: 'gym', action: 'moving', object: 'ball' },
    }
    const sportCtx = sportContext[profile.sport] || { surface: 'field', venue: 'venue', action: 'moving', object: 'ball' }

    const positionContext = (() => {
      const pos = (profile.position || '').toUpperCase()
      const sport = profile.sport
      if (sport === 'Hockey') {
        if (pos === 'G') return 'goaltender — prioritize lateral quickness, explosive power, and lower body strength'
        if (pos === 'D' || pos === 'D/F') return 'defenseman — prioritize strength, physicality, and agility for gap control'
        return 'forward — prioritize acceleration, explosive power, and agility for puck pursuit and zone entry'
      }
      if (sport === 'Soccer') {
        if (pos === 'GK') return 'goalkeeper — prioritize explosive power, lateral agility, and upper body strength'
        if (['CB','LB','RB','D'].includes(pos)) return 'defender — prioritize strength, agility, and acceleration for defensive recovery'
        if (['CM','DM','MF'].includes(pos)) return 'midfielder — prioritize endurance, agility, and speed for box-to-box play'
        return 'forward — prioritize acceleration, explosive power, and speed for finishing and pressing'
      }
      return profile.position || 'athlete'
    })()

    const prompt = `You are PeakIQ, the performance intelligence system for Peak Fitness Athletics in Dieppe, NB, Canada.

IMPORTANT RULES:
- All strength values are in POUNDS (lbs). Never convert or change units.
- Sport: ${profile.sport}. Surface: ${sportCtx.surface}. Always use sport-specific language. Never reference another sport's terminology.
- Position: ${positionContext}. Tailor all insights to what matters physically for this position.
- Write for PARENTS first — warm, clear, proud, plain English. No jargon.
- Use the athlete's first name (${firstName}) throughout. Pronouns: ${pronoun} / ${pronounCap}.
- DATA INTEGRITY RULE — CRITICAL: Never make claims about in-game performance that our testing cannot confirm. We test in a controlled setting — we do not observe games. Do NOT say things like "Marc dominates board battles" or "his acceleration is remarkable on the ice" — we have not seen this. Instead say "Marc's 10m sprint of 1.833s suggests his first-step acceleration off a stop should be noticeable" or "at 2.33x bodyweight in relative strength, Marc has the physical profile to win contact situations." Always frame game observations as what the data SUGGESTS, not what we have confirmed.
- RANKING RULE: You MAY use ranking data confidently because it is factual. "Marc ranks 2nd of 10 for squat strength among male U18 athletes tested" is confirmed data — use it proudly.
- Frame development areas as training priorities, not weaknesses.

ATHLETE: ${profile.full_name}
Sport: ${profile.sport} | Position: ${profile.position || 'N/A'} | Age Group: ${profile.age_category} | Level: ${profile.competition_level || 'N/A'} | Gender: ${profile.gender}

COMPOSITE SCORES (0-100, relative to ${profile.gender} ${profile.age_category} peers):
Overall: ${compScore?.overall_score || 'N/A'}
Speed: ${compScore?.speed_score || 'N/A'} (peer avg: ${peerAvg.speed})
Strength: ${compScore?.strength_score || 'N/A'} (peer avg: ${peerAvg.strength})
Power: ${compScore?.power_score || 'N/A'} (peer avg: ${peerAvg.power})
Agility: ${compScore?.agility_score || 'N/A'} (peer avg: ${peerAvg.agility})
Endurance: ${compScore?.endurance_score || 'N/A'} (peer avg: ${peerAvg.endurance})

IMPORTANT CONTEXT FOR FRAMING:
Speed score ${compScore?.speed_score} vs peer avg ${peerAvg.speed}: ${(compScore?.speed_score || 0) > parseFloat(peerAvg.speed) ? 'ABOVE average — frame positively' : 'BELOW average — frame as development area'}
Strength score ${compScore?.strength_score} vs peer avg ${peerAvg.strength}: ${(compScore?.strength_score || 0) > parseFloat(peerAvg.strength) ? 'ABOVE average — frame positively' : 'BELOW average — frame as development area'}
Power score ${compScore?.power_score} vs peer avg ${peerAvg.power}: ${(compScore?.power_score || 0) > parseFloat(peerAvg.power) ? 'ABOVE average — frame positively' : 'BELOW average — frame as development area'}
Agility score ${compScore?.agility_score} vs peer avg ${peerAvg.agility}: ${(compScore?.agility_score || 0) > parseFloat(peerAvg.agility) ? 'ABOVE average — frame positively' : 'BELOW average — frame as development area'}
Endurance score ${compScore?.endurance_score} vs peer avg ${peerAvg.endurance}: ${(compScore?.endurance_score || 0) > parseFloat(peerAvg.endurance) ? 'ABOVE average — frame positively' : 'BELOW average — frame as development area'}

TEST RANKINGS (among ${profile.gender} ${profile.age_category} athletes tested at Peak Fitness):
${rankingSummary}

TEST RESULTS (personal bests):
${resultsSummary}

GAME STATISTICS (${profile.sport}):
${gameContext}

REQUIRED KEYS — these must always appear in the response regardless of data availability:
this_season, speed_insight, strength_insight, power_insight, agility_insight, endurance_insight, physical_standouts, scores_summary, what_to_watch, next_steps

CONDITIONAL KEYS — only include if the relevant test data exists:
squat_insight, bench_press_insight, trap_bar_insight, pull_ups_insight, push_ups_insight, vertical_jump_insight, broad_jump_insight, mb_chest_pass_insight

Generate a JSON object with EXACTLY these keys. No markdown, no backticks, no extra text — just raw JSON:

{
  "this_season": "2-3 sentences telling the story of ${firstName}'s development season. Lead with most impressive physical gains using real numbers and rankings where available. If game stats exist, weave them in as proof. Warm, proud, narrative tone.",

  "speed_insight": "One sentence about speed. Reference actual sprint time and rank if available. Frame as suggestion for ${sportCtx.surface} performance, not confirmed observation. Above/below average per framing context.",
  "strength_insight": "One sentence about overall strength. Reference standout lift and rank. Position-relevant framing for ${positionContext}.",
  "squat_insight": "One sentence about squat. Reference e1RM, relative strength, and rank if available. Only if squat data exists.",
  "bench_press_insight": "One sentence about bench press. Reference e1RM and rank. Only if bench press data exists.",
  "trap_bar_insight": "One sentence about trap bar deadlift. Reference e1RM, relative strength, and rank. Only if trap bar data exists.",
  "pull_ups_insight": "One sentence about pull ups and rank if data exists. Otherwise omit.",
  "push_ups_insight": "One sentence about push ups and rank if data exists. Otherwise omit.",
  "power_insight": "One sentence about explosive power. Reference jump numbers and rank. Position-relevant for ${positionContext}.",
  "vertical_jump_insight": "One sentence about vertical jump and rank. Only if data exists.",
  "broad_jump_insight": "One sentence about broad jump and rank. Only if data exists.",
  "mb_chest_pass_insight": "One sentence about MB chest pass and rank. Only if data exists.",
  "agility_insight": "One sentence about agility. Reference shuttle time and rank. Position-relevant for ${positionContext}.",
  "endurance_insight": "One sentence about endurance. Reference beep test level and rank.",
  "physical_standouts": "2-3 sentences highlighting most impressive rankings and absolute numbers with peer context. Use actual rank numbers — '${firstName} ranks X of Y for [test] among [gender] [age_category] athletes tested.' This is factual and confirmed. Make every word earn its place.",
  "scores_summary": "2-3 sentences contextualizing composite scores for a parent. Frame what the overall score means. Call out 1-2 highest scoring categories with peer context. End with positive forward-looking sentence about development areas.",
  "what_to_watch": "3-4 sentences for a parent, coach, or scout watching ${profile.sport}. STRICT DATA INTEGRITY: Only reference what our testing measured. Never confirm in-game performance — only suggest what test results imply. Format: 'Watch for [${firstName}]'s [observable on-${sportCtx.surface} moment] — ${pronoun} [specific test result with number] suggests [what it implies, not confirms].' Use ranking data confidently since it is factual. Second sentence gives position-specific physical insight for a ${positionContext}. Third sentence forward-looking only if 2+ test sessions exist. Never use 'remarkable', 'dominates', or confirmed game performance language. The third sentence must NOT mention future testing sessions — that belongs in next_steps only.",
  "next_steps": "1-2 sentences about what Peak Fitness is targeting in the next testing session. Only reference metrics we actually test. Format: 'In ${firstName}'s next testing session, we will be focused on [specific test or category] — targeting [specific measurable improvement].' If a category is below peer average, mention it as priority. Never promise game outcomes or reference things we do not test. Do not end with any reference to in-game performance or on-ice/on-pitch outcomes — end at the specific measurable test target."
}

Every value must be a single string. No nested objects. No arrays. No line breaks within values. Omit conditional keys entirely if test data does not exist.`

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

    // Remove any legacy keys the model may have hallucinated
    const ALLOWED_KEYS = [
      'this_season',
      'speed_insight',
      'strength_insight', 
      'squat_insight',
      'bench_press_insight',
      'trap_bar_insight',
      'pull_ups_insight',
      'push_ups_insight',
      'power_insight',
      'vertical_jump_insight',
      'broad_jump_insight',
      'mb_chest_pass_insight',
      'agility_insight',
      'endurance_insight',
      'physical_standouts',
      'scores_summary',
      'what_to_watch',
      'next_steps'
    ]

    const cleanedInsight = {}
    for (const key of ALLOWED_KEYS) {
      if (insightJson[key]) cleanedInsight[key] = insightJson[key]
    }
    insightJson = cleanedInsight

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
