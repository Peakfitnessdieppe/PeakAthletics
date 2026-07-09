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

    const { data: benchmarks } = await supabase
      .from('pfa_benchmarks')
      .select('*')
      .eq('sport', profile.sport)
      .eq('age_category', profile.age_category)
      .eq('gender', profile.gender)

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
    console.log('[Analytics] Peer IDs found:', peerIds.length, 'for', profile.sport, profile.gender, profile.age_category)

    const { data: peerScores, error: psError } = await supabase
      .from('pfa_composite_scores')
      .select('speed_score, strength_score, power_score, agility_score, endurance_score')
      .in('athlete_id', peerIds)

    const { data: peerTestResults, error: ptrError } = await supabase
      .from('pfa_test_results')
      .select('athlete_id, test_type, value, load_value, reps')
      .in('athlete_id', peerIds)

    const { data: records } = await supabase
      .from('pfa_records')
      .select('test_type, value, athlete_id')
      .eq('gender', profile.gender)
      .eq('age_category', profile.age_category)
      .eq('sport', profile.sport)
      .eq('is_current', true)

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

    const trendByTest = {}
    for (const testType of [...new Set((results || []).map(r => r.test_type))]) {
      const testResults = (results || [])
        .filter(r => r.test_type === testType)
        .sort((a, b) => new Date(b.date_tested) - new Date(a.date_tested))
      
      if (testResults.length >= 2) {
        const latest = parseFloat(testResults[0].value)
        const previous = parseFloat(testResults[1].value)
        const isLower = ['10m_sprint', '25m_sprint', '30m_sprint', 'pro_agility_shuttle', 'illinois_agility', 't_test'].includes(testType)
        const delta = isLower ? previous - latest : latest - previous
        const pct = Math.abs((delta / previous) * 100).toFixed(1)
        const improved = delta > 0
        trendByTest[testType] = {
          latest,
          previous,
          delta: Math.abs(delta).toFixed(2),
          pct,
          improved,
          latestDate: testResults[0].date_tested,
          previousDate: testResults[1].date_tested,
        }
      }
    }

    const trendSummary = Object.entries(trendByTest).map(([test, t]) => {
      const label = test.replaceAll('_', ' ')
      const direction = t.improved ? 'improved' : 'declined'
      return `${label}: ${direction} from ${t.previous} to ${t.latest} (${t.improved ? '+' : '-'}${t.pct}%) since ${new Date(t.previousDate).toLocaleDateString()}` 
    }).join('\n') || 'Insufficient data for trend analysis (only one test session)'

    const mostRecentTestDate = results?.[0]?.date_tested ? new Date(results[0].date_tested) : null
    const now = new Date()
    const month = mostRecentTestDate ? mostRecentTestDate.getMonth() + 1 : now.getMonth() + 1

    const sportSeasonPhase = {
      Hockey: () => {
        if (month >= 5 && month <= 7) return 'Off-season — prime development window for NB hockey players. No ice commitments until August tryouts. This is the most important training period of the year for physical gains.'
        if (month === 8) return 'Pre-tryout / Training camp prep — August is crunch time for NB AAA hockey. Physical testing results now directly impact roster decisions. Every gain matters.'
        if (month >= 9 && month <= 10) return 'Early season (NB hockey) — season underway, athletes balancing games and practice load. Physical qualities from summer should be showing on the ice.'
        if (month >= 11 || month <= 2) return 'Mid-season (NB hockey) — full competitive schedule. In-season fatigue is normal and may affect testing numbers. Maintenance of key physical qualities is the priority.'
        if (month >= 3 && month <= 4) return 'Playoffs / Post-season (NB hockey) — season winding down or complete. Good time to identify development priorities for the upcoming summer window.'
      },
      Ringette: () => {
        if (month >= 4 && month <= 8) return 'Off-season (NB ringette) — prime development window. No ice commitments, ideal time for significant physical gains before the October season start.'
        if (month === 9) return 'Pre-season (NB ringette) — season starts in October. Final preparation phase, physical qualities should be peaking.'
        if (month >= 10 || month <= 3) return 'In-season (NB ringette) — competing regularly through to March. In-season fatigue may affect testing numbers. Maintenance focus.'
      },
      Soccer: () => {
        if (month >= 5 && month <= 8) return 'Outdoor season (NB soccer) — actively competing. Testing reflects in-season physical state. Gains during this period are harder to achieve due to game load.'
        if (month >= 9 && month <= 10) return 'Post-outdoor / Pre-indoor transition (NB soccer) — outdoor season wrapping up, indoor season approaching in November. Good window for physical development work.'
        if (month >= 11 || month <= 3) return 'Indoor season (NB soccer) — competing indoors through March. Maintenance of physical qualities while managing game load.'
        if (month === 4) return 'Off-season transition (NB soccer) — between indoor and outdoor seasons. Short but important window for targeted physical development before outdoor season.'
      },
      Basketball: () => {
        if (month >= 4 && month <= 9) return 'Off-season (NB basketball) — prime development window. No league commitments until November. Longest opportunity for physical gains in the yearly cycle.'
        if (month === 10) return 'Pre-season (NB basketball) — season starts in November. Final preparation phase.'
        if (month >= 11 || month <= 3) return 'In-season (NB basketball) — competing regularly through March. Maintenance focus, in-season fatigue is normal.'
      },
      Volleyball: () => {
        if (month >= 4 && month <= 8) return 'Off-season (NB volleyball) — prime development window before the fall season.'
        if (month === 9) return 'Pre-season (NB volleyball) — season starting soon. Final physical preparation.'
        if (month >= 10 || month <= 3) return 'In-season (NB volleyball) — competing regularly. Maintenance of physical qualities.'
      },
    }

    const getSeasonPhase = sportSeasonPhase[profile.sport]
    let seasonPhase
    if (getSeasonPhase) {
      seasonPhase = getSeasonPhase() || 'Competitive season — maintaining physical qualities while managing game load.'
    } else {
      if (month >= 5 && month <= 8) seasonPhase = 'Off-season — prime development window.'
      else if (month >= 9 && month <= 10) seasonPhase = 'Pre-season — ramping up for the competitive season.'
      else if (month >= 11 || month <= 2) seasonPhase = 'In-season — competing regularly, maintenance focus.'
      else seasonPhase = 'Post-season — planning next development cycle.'
    }

    // Calculate rank tiers for each test
    const rankings = {}
    if (peerIds.length === 0) {
      console.log('[Analytics] No peers found, skipping rankings')
    } else {
      for (const [testType, athleteVal] of Object.entries(athleteBestByTest)) {
        const peerVals = Object.values(peerBestByTest[testType] || {})
        if (peerVals.length === 0) continue
        const allVals = [...peerVals, athleteVal]
        allVals.sort((a, b) => LOWER_IS_BETTER.includes(testType) ? a - b : b - a)
        const rank = allVals.indexOf(athleteVal) + 1
        const total = allVals.length
        
        let tier
        if (rank === 1) tier = '#1'
        else if (rank <= Math.ceil(total * 0.1)) tier = 'Top 10%'
        else if (total >= 5 && rank <= 3) tier = 'Top 3'
        else if (total >= 8 && rank <= Math.ceil(total * 0.25)) tier = 'Top 25%'
        else if (rank <= Math.ceil(total * 0.5)) tier = 'Top 50%'
        else tier = 'Below Average'

        const record = (records || []).find(r => r.test_type === testType)
        const holdsRecord = record && record.athlete_id === athleteId
        const recordValue = record ? record.value : null

        let gapToRecord = null
        if (recordValue && !holdsRecord) {
          if (LOWER_IS_BETTER.includes(testType)) {
            gapToRecord = athleteVal - recordValue
          } else {
            gapToRecord = recordValue - athleteVal
          }
        }

        rankings[testType] = { rank, total, value: athleteVal, tier, holdsRecord, recordValue, gapToRecord }
      }
    }

    // Build ranking summary string for prompt
    const rankingSummary = Object.entries(rankings).map(([test, r]) => {
      const label = test.replaceAll('_', ' ')
      let line = `${label}: ${r.tier} (value: ${r.value})`
      if (r.holdsRecord) line += ' — CURRENT RECORD HOLDER'
      if (r.gapToRecord !== null && r.gapToRecord > 0) {
        const gapFormatted = LOWER_IS_BETTER.includes(test)
          ? `${r.gapToRecord.toFixed(3)}s behind record of ${r.recordValue}`
          : `${Math.round(r.gapToRecord)} ${test.includes('jump') || test.includes('broad') ? 'cm' : 'lbs'} behind record of ${r.recordValue}`
        line += ` — ${gapFormatted}`
      }
      return line
    }).join('\n')

    // Build best results per test
    const strengthTests = ['squat', 'bench_press', 'trap_bar_deadlift']
    const bestResults = {}
    for (const r of results || []) {
      if (!bestResults[r.test_type]) bestResults[r.test_type] = r
    }

    const formatResult = (test, r) => {
      if (!r) return '—'
      if (test === 'low_back_ext') {
        const mins = Math.floor(r.value / 60)
        const secs = String(r.value % 60).padStart(2, '0')
        return `${mins}:${secs} (duration held)`
      }
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

    const LEVEL_TIERS = ['Developing', 'On Track', 'Advanced', 'Elite Trajectory']

    const getLevelReadiness = (score) => {
      if (!score || score === 0) return 'Untested'
      if (score >= 85) return 'Elite Trajectory'
      if (score >= 70) return 'Advanced'
      if (score >= 50) return 'On Track'
      return 'Developing'
    }

    const levelReadiness = {
      overall: getLevelReadiness(compScore?.overall_score),
      speed: getLevelReadiness(compScore?.speed_score),
      strength: getLevelReadiness(compScore?.strength_score),
      power: getLevelReadiness(compScore?.power_score),
      agility: getLevelReadiness(compScore?.agility_score),
      endurance: getLevelReadiness(compScore?.endurance_score),
    }

    const levelSummary = Object.entries(levelReadiness)
      .filter(([, tier]) => tier !== 'Untested')
      .map(([cat, tier]) => `${cat}: ${tier}`)
      .join(', ')

    const testedCategories = {
      speed: (results || []).some(r => ['10m_sprint', '25m_sprint', '30m_sprint'].includes(r.test_type)),
      strength: (results || []).some(r => ['push_ups', 'pull_ups', 'squat', 'bench_press', 'trap_bar_deadlift', 'imtp'].includes(r.test_type)),
      power: (results || []).some(r => ['vertical_jump', 'broad_jump', 'triple_jump', 'ncmj', 'mb_chest_pass'].includes(r.test_type)),
      agility: (results || []).some(r => ['pro_agility_shuttle', 'illinois_agility', 't_test'].includes(r.test_type)),
      endurance: (results || []).some(r => ['beep_test', 'plank'].includes(r.test_type)),
    }

    const categoryStatus = Object.entries(testedCategories).map(([cat, tested]) =>
      tested ? `${cat}: TESTED` : `${cat}: NOT TESTED — omit insight entirely, do not frame as weakness`
    ).join('\n')

    const prompt = `You are PeakIQ, the performance intelligence system for Peak Fitness Athletics in Dieppe, NB, Canada.

IMPORTANT RULES:
- All strength values are in POUNDS (lbs). Never convert or change units.
- Low back extension (low_back_ext) values are duration in seconds — format as minutes:seconds (e.g. 180 = 3:00). Never describe this as weight or lbs. Describe it as a hold time or duration.
- Sport: ${profile.sport}. Surface: ${sportCtx.surface}. Venue: ${sportCtx.venue}. Object in play: ${sportCtx.object}. Always use sport-specific language. For Ringette: use "ring" not "puck", "ringette" not "hockey", athletes are female. Never reference another sport's terminology or equipment.
- Position: ${positionContext}. Tailor all insights to what matters physically for this position.
- Write for PARENTS first — warm, clear, proud, plain English. No jargon.
- Use the athlete's first name (${firstName}) throughout. Pronouns: ${pronoun} / ${pronounCap}.
- DATA INTEGRITY RULE — CRITICAL: Never make claims about in-game performance that our testing cannot confirm. We test in a controlled setting — we do not observe games. Always frame game observations as what the data SUGGESTS, not what we have confirmed. For example: "${firstName}'s 10m sprint suggests ${pronoun} first-step acceleration off a stop should be noticeable" or "at 2.33x bodyweight in relative strength, ${firstName} has the physical profile to win contact situations." Never say an athlete "dominates" or "is remarkable" at something we have not observed. Use "suggests", "indicates", "points to", "profiles as".
- RANKING RULE: Use tier language not raw numbers. Say 'Top 3', 'Top 25%', '#1' etc. If athlete holds a record say 'holds the [gender] [age_category] [sport] record'. If athlete is chasing a record and the gap is small (within 15% of record value), mention they are chasing it. Never say 'ranks X of Y'.
- TREND RULE: When trend data is available for a test, always reference whether the athlete improved or declined since their last session. Use specific numbers and percentages. "Cullen's IMTP improved from 32.5 to 37.1 N/kg (+14%) since June" is the target format. This is the most motivating data point for parents and athletes.
- SEASON PHASE RULE: Frame all training recommendations in the context of the current season phase. Off-season insights should emphasize development opportunity. In-season insights should emphasize maintenance and not alarm parents about scores that may be lower due to fatigue. Post-season insights should frame this as a reset and planning moment.
- LEVEL READINESS RULE: Reference Level Readiness tiers when describing an athlete's standing. 'Elite Trajectory' should trigger genuinely celebratory language. 'Developing' should be framed as early stage with clear upside, never as failure. Use the tier name naturally — 'Cullen is On Track in strength' or 'Audrée has reached Elite Trajectory in speed.'
- LANGUAGE RULE: Never use these words or phrases: 'metrics', 'composite', 'normalization', 'cohort', 'data points', 'quantitative', 'benchmarking', 'leverage', 'optimize', 'utilize'. Write like a knowledgeable coach talking to a proud parent, not a data scientist writing a report.
- CELEBRATION RULE: When an athlete is at Elite Trajectory tier, holds a record, or ranks #1 among peers — use genuinely celebratory language. These are real achievements worth celebrating. Do not be clinical or reserved. 'Audrée is one of the fastest players we have ever tested in her age group' is the right energy. Match the achievement to the tone.
- Frame development areas as training priorities, not weaknesses.
- TESTING COVERAGE — READ BEFORE WRITING ANYTHING:
${categoryStatus}

- UNTESTED CATEGORY RULE: If a category shows "NOT TESTED" — do NOT generate an insight for it. Do not include the key in the JSON at all. Do not say the athlete needs improvement in that area. It is simply untested. This applies to speed_insight, strength_insight, power_insight, agility_insight, endurance_insight and all conditional keys.

ATHLETE: ${profile.full_name}
Sport: ${profile.sport} | Position: ${profile.position || 'N/A'} | Age Group: ${profile.age_category} | Level: ${profile.competition_level || 'N/A'} | Gender: ${profile.gender}

SEASON PHASE (context for interpreting results and recommendations):
${seasonPhase}

LEVEL READINESS TIERS (Developing → On Track → Advanced → Elite Trajectory):
${levelSummary}

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

PERFORMANCE TRENDS (change since last test session):
${trendSummary}

REQUIRED KEYS — these must always appear:
this_season, physical_standouts, scores_summary, what_to_watch, next_steps

CONDITIONAL KEYS — only include if the category is TESTED and test data exists:
speed_insight, strength_insight, power_insight, agility_insight, endurance_insight, squat_insight, bench_press_insight, trap_bar_insight, pull_ups_insight, push_ups_insight, vertical_jump_insight, broad_jump_insight, mb_chest_pass_insight

Generate a JSON object with EXACTLY these keys. No markdown, no backticks, no extra text — just raw JSON:

{
  "this_season": "2-3 sentences telling the story of ${firstName}'s development season. Lead with most impressive physical gains using real numbers and rankings where available. If game stats exist, weave them in as proof. Warm, proud, narrative tone.",

  "speed_insight": "One sentence about speed. Reference actual sprint time and rank if available. Frame as suggestion for ${profile.sport} performance on the ${sportCtx.surface}, not confirmed observation. Above/below average per framing context.",
  "strength_insight": "One sentence about overall strength. Reference standout lift and rank. Position-relevant framing for ${profile.sport} — ${positionContext}.",
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
  "what_to_watch": "2-3 sentences for a parent, coach, or scout. STRICT: Only reference what testing measured. Use 'suggests' not 'is'. Lead with the most impressive ranking or record. If athlete holds a record mention it. If chasing a record mention the gap. Connect to a specific observable on-${sportCtx.surface} moment in ${profile.sport} using 'suggests' language — use correct sport terminology (${sportCtx.object}, ${sportCtx.venue}). Never confirm game performance. Third sentence only if meaningful — omit filler.",
  "next_steps": "1-2 sentences about what Peak Fitness is targeting in the next testing session. Only reference metrics we actually test. Format: 'In ${firstName}'s next testing session, we will be focused on [specific test or category] — targeting [specific measurable improvement].' If a category is below peer average, mention it as priority. Never promise game outcomes or reference things we do not test. Do not end with any reference to in-game performance or on-${sportCtx.surface} outcomes — end at the specific measurable test target."
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
