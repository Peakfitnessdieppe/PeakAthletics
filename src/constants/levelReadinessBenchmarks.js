// Level Readiness Benchmarks
// Sources: HNB = Hockey New Brunswick published standards
//          HC = Hockey Canada national targets
//          est. = research-based estimate (peer-reviewed, not governing body)
//          PFA = PFA working target (internal, no published standard)
// Units: sprint/agility in seconds, jumps in meters (broad) or inches (vertical),
//        strength in lbs (e1RM), beep test in level decimal, pull_ups/push_ups in reps

export const LOWER_IS_BETTER_TESTS = ['10m_sprint', '30m_sprint', 'pro_agility_shuttle']

export const LEVEL_LADDERS = {
  male: ['U13', 'U14', 'U15', 'U16', 'HC Junior', 'CHL-age', 'NHL/Pro'],
  female: ['U13', 'U14', 'U15', 'U16', 'HC FU18', 'IIHF Elite', 'Olympic/PWHL'],
  ringette: ['U17', 'U18', 'SNT/Junior', 'National Team'],
}

// Confidence: 'published' = governing body standard, 'est' = research estimate, 'pfa' = PFA working target
// null value = no standard exists at this level

export const BENCHMARKS = {
  male: {
    '10m_sprint': {
      unit: 's',
      lowerIsBetter: true,
      label: '10m Sprint',
      note: 'Gold standard per level. Lower is better.',
      levels: [
        { level: 'U13', value: null, confidence: null },
        { level: 'U14', value: 1.79, confidence: 'published', source: 'HNB' },
        { level: 'U15', value: 1.69, confidence: 'published', source: 'HNB' },
        { level: 'U16', value: 1.70, confidence: 'published', source: 'HNB' },
        { level: 'HC Junior', value: 1.60, confidence: 'published', source: 'Hockey Canada' },
        { level: 'CHL-age', value: null, confidence: null },
        { level: 'NHL/Pro', value: null, confidence: null },
      ],
    },

    vertical_jump: {
      unit: 'in',
      lowerIsBetter: false,
      label: 'Vertical Jump',
      note: 'Arm swing. Gold standard per level.',
      levels: [
        { level: 'U13', value: null, confidence: null },
        { level: 'U14', value: 24, confidence: 'published', source: 'HNB' },
        { level: 'U15', value: 26.5, confidence: 'published', source: 'HNB' },
        { level: 'U16', value: 29, confidence: 'published', source: 'HNB' },
        { level: 'HC Junior', value: 30, confidence: 'published', source: 'Hockey Canada' },
        { level: 'CHL-age', value: null, confidence: null },
        { level: 'NHL/Pro', value: 30, confidence: 'est', source: 'NHL combine elite tier' },
      ],
    },

    broad_jump: {
      unit: 'm',
      lowerIsBetter: false,
      label: 'Broad Jump',
      note: 'Converted to meters. HC Junior target is aspirational mid-level marker.',
      levels: [
        { level: 'U13', value: null, confidence: null },
        { level: 'U14', value: null, confidence: null },
        { level: 'U15', value: null, confidence: null },
        { level: 'U16', value: null, confidence: null },
        { level: 'HC Junior', value: 2.90, confidence: 'published', source: 'Hockey Canada — 2.90m' },
        { level: 'CHL-age', value: 2.31, confidence: 'est', source: 'PMC 2022 QMJHL n=21' },
        { level: 'NHL/Pro', value: 2.79, confidence: 'est', source: 'NHL combine avg ~110in' },
      ],
    },

    pull_ups: {
      unit: 'reps',
      lowerIsBetter: false,
      label: 'Pull-Ups',
      note: 'Cadence 50bpm protocol for AAA estimates.',
      levels: [
        { level: 'U13', value: null, confidence: null },
        { level: 'U14', value: 14, confidence: 'published', source: 'HNB Gold' },
        { level: 'U15', value: 13, confidence: 'published', source: 'HNB Gold' },
        { level: 'U16', value: 20, confidence: 'published', source: 'HNB Gold' },
        { level: 'HC Junior', value: 15, confidence: 'published', source: 'Hockey Canada' },
        { level: 'CHL-age', value: 11.5, confidence: 'est', source: 'PMC 2022 QMJHL n=21' },
        { level: 'NHL/Pro', value: 13, confidence: 'est', source: 'NHL combine avg' },
      ],
    },

    squat: {
      unit: 'lbs',
      lowerIsBetter: false,
      label: 'Squat e1RM',
      note: 'e1RM in lbs. Relative targets shown alongside absolute.',
      levels: [
        { level: 'U13', value: null, confidence: null },
        { level: 'U14', value: null, confidence: null },
        { level: 'U15', value: 220, confidence: 'est', source: 'Springer 2024 n=72 Swiss U15' },
        { level: 'U16', value: null, confidence: null },
        { level: 'HC Junior', value: 253, confidence: 'est', source: 'Sport Journal 2020 n=55 U17 AAA' },
        { level: 'CHL-age', value: 309, confidence: 'est', source: 'Raastad et al. Scandinavian junior elite n=21' },
        { level: 'NHL/Pro', value: 441, confidence: 'est', source: 'Raastad et al. n=18 pro — half squat' },
      ],
      relativeTargets: [
        { levels: ['U14', 'U15'], min: 1.0, max: 1.2, label: 'U15', confidence: 'pfa' },
        { levels: ['U16', 'HC Junior'], min: 1.3, max: 1.5, label: 'U18', confidence: 'pfa' },
        { levels: ['CHL-age'], min: 1.6, max: 1.8, label: 'CHL', confidence: 'pfa' },
        { levels: ['NHL/Pro'], min: 2.0, max: null, label: 'Pro', confidence: 'pfa' },
      ],
    },

    bench_press: {
      unit: 'lbs',
      lowerIsBetter: false,
      label: 'Bench Press e1RM',
      note: 'e1RM in lbs. Relative targets shown alongside absolute.',
      levels: [
        { level: 'U13', value: null, confidence: null },
        { level: 'U14', value: null, confidence: null },
        { level: 'U15', value: null, confidence: null },
        { level: 'U16', value: null, confidence: null },
        { level: 'HC Junior', value: null, confidence: null },
        { level: 'CHL-age', value: 166, confidence: 'est', source: 'Raastad et al. n=21 junior elite' },
        { level: 'NHL/Pro', value: 222, confidence: 'est', source: 'Raastad et al. n=18 pro' },
      ],
      relativeTargets: [
        { levels: ['U14', 'U15'], min: 0.7, max: 0.8, label: 'U15', confidence: 'pfa' },
        { levels: ['U16', 'HC Junior'], min: 0.9, max: 1.0, label: 'U18', confidence: 'pfa' },
        { levels: ['CHL-age'], min: 1.1, max: 1.2, label: 'CHL', confidence: 'pfa' },
        { levels: ['NHL/Pro'], min: 1.3, max: null, label: 'Pro', confidence: 'pfa' },
      ],
    },

    trap_bar_deadlift: {
      unit: 'lbs',
      lowerIsBetter: false,
      label: 'Trap Bar Deadlift',
      note: 'No published hockey standard exists. PFA working targets only — relative to bodyweight.',
      relativeOnly: true,
      levels: [],
      relativeTargets: [
        { levels: ['U13', 'U14'], min: 1.0, max: 1.3, label: 'U14', confidence: 'pfa' },
        { levels: ['U15', 'U16'], min: 1.3, max: 1.6, label: 'U16', confidence: 'pfa' },
        { levels: ['HC Junior'], min: 1.6, max: 2.0, label: 'U18', confidence: 'pfa' },
        { levels: ['CHL-age'], min: 2.0, max: 2.3, label: 'CHL', confidence: 'pfa' },
        { levels: ['NHL/Pro'], min: 2.3, max: 2.6, label: 'Pro', confidence: 'pfa' },
      ],
    },

    push_ups: {
      unit: 'reps',
      lowerIsBetter: false,
      label: 'Push-Ups',
      note: 'PFA working targets only — no published hockey standard.',
      levels: [],
      tieredTargets: [
        { levels: ['U13', 'U14'], bronze: 15, silver: 20, gold: 25, confidence: 'pfa' },
        { levels: ['U15', 'U16'], bronze: 20, silver: 27, gold: 35, confidence: 'pfa' },
        { levels: ['HC Junior', 'CHL-age', 'NHL/Pro'], bronze: 25, silver: 35, gold: 45, confidence: 'pfa' },
      ],
    },

    pro_agility_shuttle: {
      unit: 's',
      lowerIsBetter: true,
      label: 'Pro Agility 5-10-5',
      note: 'Gold standard per level. Lower is better.',
      levels: [
        { level: 'U13', value: null, confidence: null },
        { level: 'U14', value: 5.00, confidence: 'published', source: 'HNB Gold' },
        { level: 'U15', value: 4.75, confidence: 'published', source: 'HNB Gold' },
        { level: 'U16', value: 4.70, confidence: 'published', source: 'HNB Gold' },
        { level: 'HC Junior', value: 4.75, confidence: 'published', source: 'Hockey Canada' },
        { level: 'CHL-age', value: null, confidence: null },
        { level: 'NHL/Pro', value: 4.40, confidence: 'published', source: 'NHL combine avg' },
      ],
    },

    beep_test: {
      unit: 'level',
      lowerIsBetter: false,
      label: 'Beep Test',
      note: 'Gold standard per level.',
      levels: [
        { level: 'U13', value: null, confidence: null },
        { level: 'U14', value: 13.01, confidence: 'published', source: 'HNB Gold' },
        { level: 'U15', value: 13.07, confidence: 'published', source: 'HNB Gold' },
        { level: 'U16', value: 14.01, confidence: 'published', source: 'HNB Gold' },
        { level: 'HC Junior', value: 14.01, confidence: 'published', source: 'Hockey Canada' },
        { level: 'CHL-age', value: null, confidence: null },
        { level: 'NHL/Pro', value: null, confidence: null },
      ],
    },
  },

  female: {
    '10m_sprint': {
      unit: 's',
      lowerIsBetter: true,
      label: '10m Sprint',
      note: 'Gold standard per level. Lower is better.',
      levels: [
        { level: 'U13', value: null, confidence: null },
        { level: 'U14', value: 1.85, confidence: 'published', source: 'HNB Gold' },
        { level: 'U15', value: null, confidence: null },
        { level: 'U16', value: 1.80, confidence: 'published', source: 'HNB Gold' },
        { level: 'HC FU18', value: 1.75, confidence: 'published', source: 'Hockey Canada' },
        { level: 'IIHF Elite', value: null, confidence: null },
        { level: 'Olympic/PWHL', value: null, confidence: null },
      ],
    },

    vertical_jump: {
      unit: 'in',
      lowerIsBetter: false,
      label: 'Vertical Jump',
      note: 'Arm swing equivalent. Gold standard per level.',
      levels: [
        { level: 'U13', value: null, confidence: null },
        { level: 'U14', value: 20, confidence: 'published', source: 'HNB Gold' },
        { level: 'U15', value: null, confidence: null },
        { level: 'U16', value: 21, confidence: 'published', source: 'HNB Gold' },
        { level: 'HC FU18', value: 24, confidence: 'published', source: 'Hockey Canada — 61cm' },
        { level: 'IIHF Elite', value: 17.3, confidence: 'est', source: 'Ransdell et al. JSCR 2013 n=204' },
        { level: 'Olympic/PWHL', value: 19.8, confidence: 'est', source: 'Ransdell & Murray JSCR 2011 n=23' },
      ],
    },

    broad_jump: {
      unit: 'm',
      lowerIsBetter: false,
      label: 'Broad Jump',
      note: 'Converted to meters.',
      levels: [
        { level: 'U13', value: null, confidence: null },
        { level: 'U14', value: null, confidence: null },
        { level: 'U15', value: null, confidence: null },
        { level: 'U16', value: null, confidence: null },
        { level: 'HC FU18', value: 2.05, confidence: 'published', source: 'Hockey Canada — 2.05m' },
        { level: 'IIHF Elite', value: 1.73, confidence: 'est', source: 'Ransdell et al. 2013 U18 Group 1' },
        { level: 'Olympic/PWHL', value: 2.15, confidence: 'est', source: 'Ransdell & Murray 2011 n=23 — 214.8cm' },
      ],
    },

    pull_ups: {
      unit: 'reps',
      lowerIsBetter: false,
      label: 'Pull-Ups',
      levels: [
        { level: 'U13', value: null, confidence: null },
        { level: 'U14', value: 6, confidence: 'published', source: 'HNB Gold' },
        { level: 'U15', value: null, confidence: null },
        { level: 'U16', value: 9, confidence: 'published', source: 'HNB Gold' },
        { level: 'HC FU18', value: 6, confidence: 'published', source: 'Hockey Canada' },
        { level: 'IIHF Elite', value: 7, confidence: 'est', source: 'Ransdell et al. 2013 U18 Group 1' },
        { level: 'Olympic/PWHL', value: 10, confidence: 'est', source: 'Ransdell & Murray 2011 n=23' },
      ],
    },

    squat: {
      unit: 'lbs',
      lowerIsBetter: false,
      label: 'Squat e1RM',
      note: 'Limited published data. PFA relative targets used below U18.',
      levels: [
        { level: 'U13', value: null, confidence: null },
        { level: 'U14', value: null, confidence: null },
        { level: 'U15', value: null, confidence: null },
        { level: 'U16', value: null, confidence: null },
        { level: 'HC FU18', value: null, confidence: null },
        { level: 'IIHF Elite', value: null, confidence: null },
        { level: 'Olympic/PWHL', value: 195, confidence: 'est', source: 'Ransdell & Murray 2011 n=23 — front squat' },
      ],
      relativeTargets: [
        { levels: ['U13', 'U14'], min: 0.8, max: 1.0, label: 'U14', confidence: 'pfa' },
        { levels: ['U15', 'U16'], min: 1.0, max: 1.2, label: 'U16', confidence: 'pfa' },
        { levels: ['HC FU18', 'IIHF Elite'], min: 1.1, max: 1.3, label: 'U18', confidence: 'pfa' },
        { levels: ['Olympic/PWHL'], min: 1.3, max: 1.5, label: 'Elite', confidence: 'pfa' },
      ],
    },

    bench_press: {
      unit: 'lbs',
      lowerIsBetter: false,
      label: 'Bench Press e1RM',
      note: 'Limited published data. PFA relative targets used below elite.',
      levels: [
        { level: 'U13', value: null, confidence: null },
        { level: 'U14', value: null, confidence: null },
        { level: 'U15', value: null, confidence: null },
        { level: 'U16', value: null, confidence: null },
        { level: 'HC FU18', value: null, confidence: null },
        { level: 'IIHF Elite', value: null, confidence: null },
        { level: 'Olympic/PWHL', value: 144, confidence: 'est', source: 'Ransdell & Murray 2011 n=23' },
      ],
      relativeTargets: [
        { levels: ['U13', 'U14'], min: 0.5, max: 0.65, label: 'U14', confidence: 'pfa' },
        { levels: ['U15', 'U16'], min: 0.65, max: 0.8, label: 'U16', confidence: 'pfa' },
        { levels: ['HC FU18', 'IIHF Elite'], min: 0.8, max: 0.95, label: 'U18', confidence: 'pfa' },
        { levels: ['Olympic/PWHL'], min: 1.0, max: null, label: 'Elite', confidence: 'pfa' },
      ],
    },

    trap_bar_deadlift: {
      unit: 'lbs',
      lowerIsBetter: false,
      label: 'Trap Bar Deadlift',
      note: 'No published standard at any level. PFA working targets only.',
      relativeOnly: true,
      levels: [],
      relativeTargets: [
        { levels: ['U13', 'U14'], min: 0.8, max: 1.1, label: 'U14', confidence: 'pfa' },
        { levels: ['U15', 'U16'], min: 1.1, max: 1.4, label: 'U16', confidence: 'pfa' },
        { levels: ['HC FU18', 'IIHF Elite'], min: 1.4, max: 1.7, label: 'U18', confidence: 'pfa' },
        { levels: ['Olympic/PWHL'], min: 1.7, max: 2.0, label: 'Elite', confidence: 'pfa' },
      ],
    },

    push_ups: {
      unit: 'reps',
      lowerIsBetter: false,
      label: 'Push-Ups',
      note: 'PFA working targets only — no published standard.',
      levels: [],
      tieredTargets: [
        { levels: ['U13', 'U14'], bronze: 8, silver: 13, gold: 18, confidence: 'pfa' },
        { levels: ['U15', 'U16'], bronze: 12, silver: 18, gold: 25, confidence: 'pfa' },
        { levels: ['HC FU18', 'IIHF Elite', 'Olympic/PWHL'], bronze: 15, silver: 22, gold: 30, confidence: 'pfa' },
      ],
    },

    pro_agility_shuttle: {
      unit: 's',
      lowerIsBetter: true,
      label: 'Pro Agility 5-10-5',
      note: 'Gold standard per level. Lower is better.',
      levels: [
        { level: 'U13', value: null, confidence: null },
        { level: 'U14', value: 5.30, confidence: 'published', source: 'HNB Gold' },
        { level: 'U15', value: null, confidence: null },
        { level: 'U16', value: 5.10, confidence: 'published', source: 'HNB Gold' },
        { level: 'HC FU18', value: 5.20, confidence: 'published', source: 'Hockey Canada' },
        { level: 'IIHF Elite', value: null, confidence: null },
        { level: 'Olympic/PWHL', value: null, confidence: null },
      ],
    },

    beep_test: {
      unit: 'level',
      lowerIsBetter: false,
      label: 'Beep Test',
      note: 'Gold standard per level.',
      levels: [
        { level: 'U13', value: null, confidence: null },
        { level: 'U14', value: 10.01, confidence: 'published', source: 'HNB Gold' },
        { level: 'U15', value: null, confidence: null },
        { level: 'U16', value: 11.01, confidence: 'published', source: 'HNB Gold' },
        { level: 'HC FU18', value: 11.01, confidence: 'published', source: 'Hockey Canada' },
        { level: 'IIHF Elite', value: null, confidence: null },
        { level: 'Olympic/PWHL', value: null, confidence: null },
      ],
    },
  },

  ringette: {
    '10m_sprint': {
      unit: 's',
      lowerIsBetter: true,
      label: '10m Sprint',
      note: 'Ringette Canada National Team targets 2024-2025. Lower is better.',
      levels: [
        { level: 'U17', value: 1.94, confidence: 'published', source: 'Ringette Canada Bronze' },
        { level: 'U18', value: 1.87, confidence: 'published', source: 'Ringette Canada Silver' },
        { level: 'SNT/Junior', value: 1.80, confidence: 'published', source: 'Ringette Canada Gold' },
        { level: 'National Team', value: 1.80, confidence: 'published', source: 'Ringette Canada Gold' },
      ],
    },

    '30m_sprint': {
      unit: 's',
      lowerIsBetter: true,
      label: '30m Sprint',
      note: 'Ringette Canada National Team targets 2024-2025. Lower is better.',
      levels: [
        { level: 'U17', value: 4.82, confidence: 'published', source: 'Ringette Canada Bronze' },
        { level: 'U18', value: 4.67, confidence: 'published', source: 'Ringette Canada Silver' },
        { level: 'SNT/Junior', value: 4.55, confidence: 'published', source: 'Ringette Canada Gold' },
        { level: 'National Team', value: 4.55, confidence: 'published', source: 'Ringette Canada Gold' },
      ],
    },

    broad_jump: {
      unit: 'm',
      lowerIsBetter: false,
      label: 'Standing Long Jump',
      note: 'Ringette Canada National Team targets 2024-2025.',
      levels: [
        { level: 'U17', value: 2.01, confidence: 'published', source: 'Ringette Canada Bronze' },
        { level: 'U18', value: 2.10, confidence: 'published', source: 'Ringette Canada Silver' },
        { level: 'SNT/Junior', value: 2.55, confidence: 'published', source: 'Ringette Canada Gold' },
        { level: 'National Team', value: 2.55, confidence: 'published', source: 'Ringette Canada Gold' },
      ],
    },

    triple_jump: {
      unit: 'm',
      lowerIsBetter: false,
      label: 'Triple Jump',
      note: 'Ringette Canada National Team targets 2024-2025. Value in meters.',
      levels: [
        { level: 'U17', value: 6.28, confidence: 'published', source: 'Ringette Canada Bronze' },
        { level: 'U18', value: 6.46, confidence: 'published', source: 'Ringette Canada Silver' },
        { level: 'SNT/Junior', value: 6.90, confidence: 'published', source: 'Ringette Canada Gold' },
        { level: 'National Team', value: 6.90, confidence: 'published', source: 'Ringette Canada Gold' },
      ],
    },

    pull_ups: {
      unit: 'reps',
      lowerIsBetter: false,
      label: 'Chin-Ups',
      note: 'Ringette Canada National Team targets 2024-2025.',
      levels: [
        { level: 'U17', value: 2, confidence: 'published', source: 'Ringette Canada Bronze' },
        { level: 'U18', value: 4, confidence: 'published', source: 'Ringette Canada Silver' },
        { level: 'SNT/Junior', value: 9, confidence: 'published', source: 'Ringette Canada Gold' },
        { level: 'National Team', value: 9, confidence: 'published', source: 'Ringette Canada Gold' },
      ],
    },

    push_ups: {
      unit: 'reps',
      lowerIsBetter: false,
      label: 'Push-Ups',
      note: 'Ringette Canada National Team targets 2024-2025.',
      levels: [
        { level: 'U17', value: 20, confidence: 'published', source: 'Ringette Canada Bronze' },
        { level: 'U18', value: 24, confidence: 'published', source: 'Ringette Canada Silver' },
        { level: 'SNT/Junior', value: 31, confidence: 'published', source: 'Ringette Canada Gold' },
        { level: 'National Team', value: 31, confidence: 'published', source: 'Ringette Canada Gold' },
      ],
    },

    beep_test: {
      unit: 'level',
      lowerIsBetter: false,
      label: 'AIS 20m Shuttle',
      note: 'Ringette Canada National Team targets 2024-2025.',
      levels: [
        { level: 'U17', value: 8.0, confidence: 'published', source: 'Ringette Canada Bronze' },
        { level: 'U18', value: 9.0, confidence: 'published', source: 'Ringette Canada Silver' },
        { level: 'SNT/Junior', value: 10.5, confidence: 'published', source: 'Ringette Canada Gold' },
        { level: 'National Team', value: 10.5, confidence: 'published', source: 'Ringette Canada Gold' },
      ],
    },

    plank: {
      unit: 's',
      lowerIsBetter: false,
      label: 'Plank',
      note: 'Ringette Canada National Team targets 2024-2025.',
      levels: [
        { level: 'U17', value: 120, confidence: 'published', source: 'Ringette Canada Bronze' },
        { level: 'U18', value: 120, confidence: 'published', source: 'Ringette Canada Silver' },
        { level: 'SNT/Junior', value: 120, confidence: 'published', source: 'Ringette Canada Gold' },
        { level: 'National Team', value: 120, confidence: 'published', source: 'Ringette Canada Gold' },
      ],
    },
  },
}

// Tier assignment logic
// Call with: getTier(athleteValue, benchmarks, athleteLevelIndex, gender)
// Returns: 'Elite Trajectory' | 'Advanced' | 'On Track' | 'Developing'
export const getTier = (athleteValue, testKey, gender, athleteLevelIndex) => {
  if (athleteValue == null) return null
  const bench = BENCHMARKS[gender]?.[testKey]
  if (!bench) return null
  const levels = bench.levels.filter(l => l.value != null)
  if (levels.length === 0) return null

  const isLower = bench.lowerIsBetter

  const beats = (val, benchmark) => isLower ? val <= benchmark : val >= benchmark

  // Find which levels the athlete beats
  const beaten = levels.filter(l => beats(athleteValue, l.value))

  // Map level names to ladder index
  const ladder = LEVEL_LADDERS[gender]
  const getIndex = (levelName) => ladder.indexOf(levelName)
  const athleteLadderIdx = athleteLevelIndex

  if (beaten.length === 0) return 'Developing'

  const highestBeaten = beaten.reduce((best, l) => {
    return getIndex(l.level) > getIndex(best.level) ? l : best
  }, beaten[0])

  const highestIdx = getIndex(highestBeaten.level)
  const gap = highestIdx - athleteLadderIdx

  if (gap >= 2) return 'Elite Trajectory'
  if (gap >= 1) return 'Advanced'
  if (gap >= 0) return 'On Track'
  return 'Developing'
}

export const TIER_COLORS = {
  'Elite Trajectory': '#a855f7',
  'Advanced': '#3fae52',
  'On Track': '#06b6d4',
  'Developing': 'rgba(255,255,255,0.4)',
}

export const TIER_DESCRIPTIONS = {
  'Elite Trajectory': 'Meeting standards 2+ levels ahead',
  'Advanced': 'Meeting the next level\'s standard',
  'On Track': 'Meeting current age group standard',
  'Developing': 'Working toward current age group standard',
}
