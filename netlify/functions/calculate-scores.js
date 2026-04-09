const { createClient } = require('@supabase/supabase-js')

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  const { athleteIds } = JSON.parse(event.body || '{}')

  // Test definitions
  const LOWER_IS_BETTER = ['10m_sprint', 'pro_agility_shuttle']
  
  const CATEGORY_TESTS = {
    speed: ['10m_sprint'],
    power: ['vertical_jump', 'broad_jump'],
    strength: ['squat', 'bench_press', 'trap_bar_deadlift', 'pull_ups', 'push_ups'],
    agility: ['pro_agility_shuttle'],
    endurance: ['beep_test']
  }

  const DEFAULT_WEIGHTS = {
    speed: 0.25, power: 0.25, strength: 0.25, agility: 0.15, endurance: 0.10
  }

  // Fetch athletes to process
  let athleteQuery = supabaseAdmin
    .from('profiles')
    .select('id, sport, age_category')
    .eq('role', 'athlete')
  
  if (athleteIds && athleteIds.length > 0) {
    athleteQuery = athleteQuery.in('id', athleteIds)
  }
  
  const { data: athletes, error: athleteError } = await athleteQuery
  if (athleteError) {
    return { statusCode: 400, body: JSON.stringify({ error: athleteError.message }) }
  }

  // Fetch all custom weight overrides
  const { data: weightOverrides } = await supabaseAdmin
    .from('pfa_score_weights')
    .select('*')

  // Helper to get weights for a sport+age combo
  const getWeights = (sport, ageCategory) => {
    const override = (weightOverrides || []).find(
      w => w.sport === sport && w.age_category === ageCategory
    )
    if (override) {
      return {
        speed: override.speed_weight,
        power: override.power_weight,
        strength: override.strength_weight,
        agility: override.agility_weight,
        endurance: override.endurance_weight
      }
    }
    return DEFAULT_WEIGHTS
  }

  // Fetch all test results for these athletes
  const athleteIdList = athletes.map(a => a.id)
  const { data: allResults } = await supabaseAdmin
    .from('pfa_test_results')
    .select('athlete_id, test_type, value, date_tested')
    .in('athlete_id', athleteIdList)

  // Fetch peer stats for Z-score normalization
  // Group athletes by sport+age_category for peer comparison
  const peerGroups = {}
  for (const athlete of athletes) {
    const key = `${athlete.sport}__${athlete.age_category}` 
    if (!peerGroups[key]) peerGroups[key] = []
    peerGroups[key].push(athlete.id)
  }

  // For each peer group, compute mean and stddev per test_type
  const peerStats = {}
  for (const [key, ids] of Object.entries(peerGroups)) {
    const groupResults = (allResults || []).filter(r => ids.includes(r.athlete_id))
    const byTest = {}
    for (const r of groupResults) {
      if (!byTest[r.test_type]) byTest[r.test_type] = []
      byTest[r.test_type].push(r.value)
    }
    peerStats[key] = {}
    for (const [testType, values] of Object.entries(byTest)) {
      if (values.length < 2) continue
      const mean = values.reduce((a, b) => a + b, 0) / values.length
      const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length
      const stddev = Math.sqrt(variance)
      peerStats[key][testType] = { mean, stddev }
    }
  }

  // Normalize a single value to 0-100 using Z-score
  const normalizeValue = (testType, value, stats) => {
    if (!stats || !stats[testType] || stats[testType].stddev === 0) {
      // Fallback: use fixed ranges
      const FIXED_RANGES = {
        '10m_sprint': { min: 1.4, max: 2.5 },
        'vertical_jump': { min: 20, max: 80 },
        'broad_jump': { min: 1.0, max: 3.0 },
        'pro_agility_shuttle': { min: 4.0, max: 7.0 },
        'beep_test': { min: 3, max: 15 },
        'squat': { min: 50, max: 400 },
        'bench_press': { min: 40, max: 300 },
        'trap_bar_deadlift': { min: 60, max: 500 },
        'pull_ups': { min: 0, max: 30 },
        'push_ups': { min: 0, max: 60 },
      }
      const range = FIXED_RANGES[testType]
      if (!range) return 50
      const isLower = LOWER_IS_BETTER.includes(testType)
      const pct = (value - range.min) / (range.max - range.min)
      const clamped = Math.max(0, Math.min(1, pct))
      return isLower ? Math.round((1 - clamped) * 100) : Math.round(clamped * 100)
    }
    const { mean, stddev } = stats[testType]
    const z = (value - mean) / stddev
    const adjusted = LOWER_IS_BETTER.includes(testType) ? -z : z
    return Math.max(0, Math.min(100, Math.round(50 + adjusted * 15)))
  }

  // Calculate scores for each athlete
  const upsertRows = []

  for (const athlete of athletes) {
    const peerKey = `${athlete.sport}__${athlete.age_category}` 
    const stats = peerStats[peerKey] || {}
    const weights = getWeights(athlete.sport, athlete.age_category)

    // Get best result per test_type for this athlete
    const athleteResults = (allResults || []).filter(r => r.athlete_id === athlete.id)
    const bestPerTest = {}
    for (const r of athleteResults) {
      const current = bestPerTest[r.test_type]
      if (!current) {
        bestPerTest[r.test_type] = r.value
      } else {
        const isBetter = LOWER_IS_BETTER.includes(r.test_type)
          ? r.value < current
          : r.value > current
        if (isBetter) bestPerTest[r.test_type] = r.value
      }
    }

    // Calculate category scores
    const categoryScores = {}
    for (const [category, tests] of Object.entries(CATEGORY_TESTS)) {
      const scores = []
      for (const testType of tests) {
        if (bestPerTest[testType] !== undefined) {
          scores.push(normalizeValue(testType, bestPerTest[testType], stats))
        }
      }
      categoryScores[category] = scores.length > 0
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : null
    }

    // Calculate overall weighted score
    let weightedSum = 0
    let weightedTotal = 0
    for (const [category, score] of Object.entries(categoryScores)) {
      if (score !== null) {
        weightedSum += score * weights[category]
        weightedTotal += weights[category]
      }
    }
    const overallScore = weightedTotal > 0
      ? Math.round(weightedSum / weightedTotal)
      : null

    if (overallScore !== null) {
      upsertRows.push({
        athlete_id: athlete.id,
        overall_score: overallScore,
        speed_score: categoryScores.speed,
        power_score: categoryScores.power,
        strength_score: categoryScores.strength,
        agility_score: categoryScores.agility,
        endurance_score: categoryScores.endurance,
        calculated_at: new Date().toISOString()
      })
    }
  }

  if (upsertRows.length > 0) {
    const { error: upsertError } = await supabaseAdmin
      .from('pfa_composite_scores')
      .upsert(upsertRows, { onConflict: 'athlete_id' })
    
    if (upsertError) {
      return { 
        statusCode: 400, 
        body: JSON.stringify({ error: upsertError.message }) 
      }
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ 
      success: true, 
      processed: upsertRows.length,
      message: `Calculated scores for ${upsertRows.length} athletes` 
    })
  }
}
