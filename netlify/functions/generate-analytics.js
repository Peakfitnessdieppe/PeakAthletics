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
    const { athleteId, audience } = JSON.parse(event.body)
    console.log('Request received:', { athleteId, audience })
    if (!athleteId) return { statusCode: 400, body: JSON.stringify({ error: 'Missing athleteId' }) }

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', athleteId)
      .single()

    const { data: results } = await supabase
      .from('pfa_test_results')
      .select('*, load_value, reps, relative_strength')
      .eq('athlete_id', athleteId)
      .order('date_tested', { ascending: false })

    const { data: gameStats } = await supabase
      .from('game_stats')
      .select('*')
      .eq('athlete_id', athleteId)
      .order('scraped_at', { ascending: false })
      .limit(1)

    const { data: peerStats } = await supabase
      .from('pfa_peer_stats')
      .select('*')
      .eq('sport', profile?.sport)
      .eq('age_category', profile?.age_category)
      .eq('gender', profile?.gender)

    const strengthTests = ['squat', 'bench_press', 'trap_bar_deadlift']
    const bestResults = {}
    for (const r of results || []) {
      if (!bestResults[r.test_type]) bestResults[r.test_type] = r
    }

    const formatStrength = (r) => {
      if (!r) return '—'
      const e1rm = `${Math.round(r.value)} lbs e1RM`
      const loadReps = r.load_value && r.reps ? ` (from ${r.load_value} lbs × ${r.reps} reps)` : ' (estimated)'
      const rel = r.relative_strength ? ` — Relative Strength: ${r.relative_strength}× BW` : ''
      return e1rm + loadReps + rel
    }

    const formatResult = (test, r) => {
      if (strengthTests.includes(test)) return formatStrength(r)
      if (!r) return '—'
      return `${r.value} ${r.unit || ''} (${r.category})`
    }

    const peerContext = (peerStats || [])
      .map((p) => {
        const base = `${p.test_type}: peer mean=${Number(p.mean).toFixed(2)}${strengthTests.includes(p.test_type) ? ' lbs' : ''}, std_dev=${Number(p.std_dev).toFixed(2)}, n=${p.n}`
        return base
      })
      .join('\n')

    const resultsSummary = Object.entries(bestResults)
      .map(([test, r]) => `${test}: ${formatResult(test, r)}`)
      .join('\n')

    const gs = gameStats?.[0]
    const gameContext = gs
      ? `Game Stats (${gs.league} ${gs.season}): ${gs.games_played}GP ${gs.goals}G ${gs.assists}A ${gs.points}PTS ${(gs.points / gs.games_played).toFixed(2)}PPG`
      : 'No game stats available'

    const audienceInstructions = {
      athlete: 'Write directly to the athlete in second person. Be motivating, honest, and specific. Focus on what they can improve and what they are excelling at.',
      family: "Write to the athlete's family. Be informative and encouraging. Explain what the scores mean in plain language.",
      pfa_admin: 'Write a detailed technical analysis for coaching staff. Include specific recommendations for training focus areas.',
      pfa_staff: 'Write a detailed technical analysis for coaching staff. Include specific recommendations for training focus areas.',
      team_coach: "Write for the team coach. Focus on how this athlete's physical profile impacts their role on the team and areas to develop.",
    }

    const tone = audienceInstructions[audience] || audienceInstructions.athlete

    const prompt = `IMPORTANT: All weight and strength values in this report are in POUNDS (lbs), not kilograms. Never convert these values. Always write "lbs" when referring to any strength measurement.

You are PeakIQ, an elite sports performance analyst for Peak Fitness Athletics in Dieppe, NB, Canada. You specialize in youth hockey and multi-sport athlete development.

Generate a comprehensive performance insight report for the following athlete:

ATHLETE PROFILE:
Name: ${profile?.full_name}
Sport: ${profile?.sport}
Position: ${profile?.position}
Age Category: ${profile?.age_category}
Competition Level: ${profile?.competition_level}
Gender: ${profile?.gender}
Date of Birth: ${profile?.date_of_birth}

DRYLAND TEST RESULTS (personal bests):
${resultsSummary}

PEER GROUP CONTEXT (${profile?.sport} ${profile?.age_category} ${profile?.gender}):
${peerContext}

ON-ICE GAME STATISTICS:
${gameContext}

INSTRUCTIONS:
${tone}

Format your response with these exact section headers in ALL CAPS and bold, followed by a colon:
PERFORMANCE SUMMARY
KEY STRENGTHS
AREAS FOR DEVELOPMENT
TRAINING RECOMMENDATIONS

Use numbered lists for strengths, areas, and recommendations. Each item should have a bold title followed by a colon and explanation. Keep a professional, motivating tone appropriate for athletes and coaches. Do not use markdown symbols like # or ** — use plain text formatting only. Be specific, data-driven, and use the peer group context to frame whether results are above or below average. Keep the total response under 600 words. Do not use generic language — reference actual test results and numbers.`

    console.log('Calling OpenAI with prompt length:', prompt.length)
    console.log('OpenAI key present:', !!process.env.OPENAI_API_KEY)

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2000,
        temperature: 0.7,
      }),
    })

    if (!openaiRes.ok) {
      const err = await openaiRes.text()
      console.error('OpenAI error:', err)
      return { statusCode: 500, body: JSON.stringify({ error: 'OpenAI request failed' }) }
    }

    const openaiData = await openaiRes.json()
    const insight = openaiData.choices?.[0]?.message?.content || ''

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ insight }),
    }
  } catch (err) {
    console.error('generate-analytics error:', err.message, err.stack)
    return { statusCode: 500, body: JSON.stringify({ error: err.message, stack: err.stack }) }
  }
}
