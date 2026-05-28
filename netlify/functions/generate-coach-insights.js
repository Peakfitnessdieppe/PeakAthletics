const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  try {
    const { teamId } = JSON.parse(event.body)
    if (!teamId) return { statusCode: 400, body: JSON.stringify({ error: 'teamId required' }) }

    const { data: cached } = await supabase
      .from('pfa_coach_insights')
      .select('insight_json, generated_at, test_session_date')
      .eq('team_id', teamId)
      .single()

    if (cached?.insight_json) {
      return {
        statusCode: 200,
        body: JSON.stringify({ insight: cached.insight_json, generated_at: cached.generated_at, test_session_date: cached.test_session_date, cached: true }),
      }
    }

    const { data: team } = await supabase
      .from('pfa_teams')
      .select('name, sport, age_category, competition_level')
      .eq('id', teamId)
      .single()

    const { data: links } = await supabase
      .from('athlete_teams')
      .select('athlete_id')
      .eq('team_id', teamId)

    const athleteIds = (links || []).map((l) => l.athlete_id)
    if (!athleteIds.length) {
      return { statusCode: 200, body: JSON.stringify({ insight: null }) }
    }

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, position, age_category, gender, sport')
      .in('id', athleteIds)

    const { data: allScores } = await supabase
      .from('pfa_composite_scores')
      .select('athlete_id, overall_score, speed_score, power_score, strength_score, agility_score, endurance_score, calculated_at')
      .in('athlete_id', athleteIds)
      .order('calculated_at', { ascending: false })

    const latestScores = {}
    ;(allScores || []).forEach((s) => {
      if (!latestScores[s.athlete_id]) latestScores[s.athlete_id] = s
    })

    const { data: allResults } = await supabase
      .from('pfa_test_results')
      .select('athlete_id, test_type, value, load_value, reps, date_tested, category')
      .in('athlete_id', athleteIds)
      .order('date_tested', { ascending: false })

    const mostRecentTestDate = (allResults || []).length > 0 ? allResults[0].date_tested : null

    const lastTestedByAthlete = {}
    ;(allResults || []).forEach((r) => {
      if (!lastTestedByAthlete[r.athlete_id]) lastTestedByAthlete[r.athlete_id] = r.date_tested
    })

    const sampleProfile = (profiles || [])[0]
    let peerStats = []
    if (sampleProfile) {
      const { data: ps } = await supabase
        .from('pfa_peer_stats')
        .select('*')
        .eq('sport', sampleProfile.sport)
        .eq('age_category', sampleProfile.age_category)
        .eq('gender', sampleProfile.gender)
      peerStats = ps || []
    }

    const { data: peerScores } = await supabase
      .from('pfa_composite_scores')
      .select('overall_score, speed_score, power_score, strength_score, agility_score, endurance_score')

    const peerAvg = { overall: 0, speed: 0, strength: 0, power: 0, agility: 0, endurance: 0 }
    const peerCount = { overall: 0, speed: 0, strength: 0, power: 0, agility: 0, endurance: 0 }
    ;(peerScores || []).forEach((s) => {
      const cats = ['overall', 'speed', 'strength', 'power', 'agility', 'endurance']
      cats.forEach((c) => {
        const val = s[`${c}_score`]
        if (typeof val === 'number' && val > 0) {
          peerAvg[c] += val
          peerCount[c]++
        }
      })
    })
    Object.keys(peerAvg).forEach((c) => {
      peerAvg[c] = peerCount[c] > 0 ? Math.round(peerAvg[c] / peerCount[c]) : null
    })

    const athleteSummaries = (profiles || []).map((p) => {
      const scores = latestScores[p.id]
      const lastTested = lastTestedByAthlete[p.id]
      const daysAgo = lastTested ? Math.floor((Date.now() - new Date(lastTested).getTime()) / (1000 * 60 * 60 * 24)) : null
      const testTypes = [...new Set((allResults || []).filter((r) => r.athlete_id === p.id).map((r) => r.test_type))]
      return {
        name: p.full_name,
        position: p.position,
        lastTestedDaysAgo: daysAgo,
        testedCategories: testTypes.length,
        overall: scores?.overall_score ?? null,
        speed: scores?.speed_score ?? null,
        strength: scores?.strength_score ?? null,
        power: scores?.power_score ?? null,
        agility: scores?.agility_score ?? null,
        endurance: scores?.endurance_score ?? null,
      }
    })

    const teamAvg = { overall: 0, speed: 0, strength: 0, power: 0, agility: 0, endurance: 0 }
    const teamCount = { overall: 0, speed: 0, strength: 0, power: 0, agility: 0, endurance: 0 }
    athleteSummaries.forEach((a) => {
      const cats = ['overall', 'speed', 'strength', 'power', 'agility', 'endurance']
      cats.forEach((c) => {
        if (typeof a[c] === 'number' && a[c] > 0) {
          teamAvg[c] += a[c]
          teamCount[c]++
        }
      })
    })
    Object.keys(teamAvg).forEach((c) => {
      teamAvg[c] = teamCount[c] > 0 ? Math.round(teamAvg[c] / teamCount[c]) : null
    })

    const testedCategories = {
      speed: athleteSummaries.filter(a => a.speed !== null).length,
      strength: athleteSummaries.filter(a => a.strength !== null).length,
      power: athleteSummaries.filter(a => a.power !== null).length,
      agility: athleteSummaries.filter(a => a.agility !== null).length,
      endurance: athleteSummaries.filter(a => a.endurance !== null).length,
    }
    const totalAthletes = athleteSummaries.length
    const categoryStatus = Object.entries(testedCategories).map(([cat, count]) => {
      if (count === 0) return `${cat}: NO ATHLETES TESTED — omit from analysis, do not treat as weakness`
      if (count < totalAthletes) return `${cat}: ${count}/${totalAthletes} athletes tested — partial data, flag gaps but do not penalize team average`
      return `${cat}: all ${count} athletes tested`
    }).join('\n')

    const prompt = `You are a performance director briefing a coach before practice. Your job is to surface what the data is showing — not to tell the coach what they already know. The coach has the eyes. You have the numbers.

Team: ${team?.name || 'Unknown'} | ${team?.sport} | ${team?.age_category} | ${team?.competition_level}
Most recent test session: ${mostRecentTestDate ? new Date(mostRecentTestDate).toLocaleDateString() : 'Unknown'}

TESTING COVERAGE — READ THIS BEFORE WRITING ANYTHING:
${categoryStatus}

CRITICAL RULES:
- If a category shows "NO ATHLETES TESTED" — do NOT mention it as a weakness, gap, or area needing improvement. It is simply untested. Omit it entirely from team_pulse, collective_gap, and heatmap_read.
- If a category is partially tested, you may mention gaps exist but do not treat missing scores as low scores.
- Only draw conclusions from categories where meaningful data exists (at least 30% of athletes tested).
- The heatmap_read must only reference scores and categories that actually appear in the grid data below.

TEAM AVERAGES vs PEER DATABASE (only shown for tested categories):
Overall: Team ${teamAvg.overall ?? '—'} vs Peer ${peerAvg.overall ?? '—'}
Speed: Team ${teamAvg.speed ?? '—'} vs Peer ${peerAvg.speed ?? '—'}
Strength: Team ${teamAvg.strength ?? '—'} vs Peer ${peerAvg.strength ?? '—'}
Power: Team ${teamAvg.power ?? '—'} vs Peer ${peerAvg.power ?? '—'}
Agility: Team ${teamAvg.agility ?? '—'} vs Peer ${peerAvg.agility ?? '—'}
Endurance: Team ${teamAvg.endurance ?? '—'} vs Peer ${peerAvg.endurance ?? '—'}

INDIVIDUAL ATHLETE PROFILES:
${athleteSummaries.map((a) => `${a.name} (${a.position}): Overall ${a.overall ?? 'untested'}, Speed ${a.speed ?? 'untested'}, Strength ${a.strength ?? 'untested'}, Power ${a.power ?? 'untested'}, Agility ${a.agility ?? 'untested'}, Endurance ${a.endurance ?? 'untested'} | Last tested: ${a.lastTestedDaysAgo != null ? a.lastTestedDaysAgo + ' days ago' : 'never'}`).join('\n')}

Respond ONLY with a valid JSON object. No markdown, no explanation, no backticks. Use exactly these keys:
{
  "team_pulse": "2-3 sentences on where this team sits physically as a unit vs peers. Be specific with numbers. Reference the most recent test date. Only mention categories with sufficient test coverage.",
  "data_flags": "2-3 specific things the data is surfacing that the coach should watch for and confirm with their eyes. Frame each as an observation to verify, not a conclusion. Use athlete names. Only flag categories where data exists. Separate each flag with a line break.",
  "testing_gaps": "Which athletes have incomplete physical profiles and what categories are missing. If an entire category is untested across the whole team, note it as a team-wide testing gap, not a performance weakness.",
  "collective_strength": "The one physical quality this team does best as a group, with peer context and specific numbers. Only choose from categories with full or near-full test coverage.",
  "collective_gap": "The one physical quality holding this team back most, with peer context and specific numbers. Only choose from categories where meaningful data exists — do not cite untested categories as gaps.",
  "heatmap_read": "2-3 sentences interpreting the team grid. Only reference categories and scores that actually appear in the grid. Note which categories show the widest spread between athletes. Be specific with names and numbers from the grid only."
}`

    const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 1000,
        temperature: 0.4,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    const aiJson = await aiRes.json()
    const raw = aiJson.choices?.[0]?.message?.content || ''
    let insight = null
    try {
      const clean = raw.replace(/```json|```/g, '').trim()
      insight = JSON.parse(clean)
    } catch (e) {
      console.error('Failed to parse coach insights JSON:', raw)
      return { statusCode: 500, body: JSON.stringify({ error: 'Failed to parse AI response' }) }
    }

    await supabase.from('pfa_coach_insights').upsert({
      team_id: teamId,
      insight_json: insight,
      generated_at: new Date().toISOString(),
      test_session_date: mostRecentTestDate,
    }, { onConflict: 'team_id' })

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ insight, generated_at: new Date().toISOString(), test_session_date: mostRecentTestDate }),
    }

  } catch (err) {
    console.error('generate-coach-insights error:', err)
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}
