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
        { level: 'U14', value: 1.79, confidence: 'published', source: 'HNB Gold' },
        { level: 'U14', value: 1.87, confidence: 'published', source: 'HNB Silver' },
        { level: 'U14', value: 1.95, confidence: 'published', source: 'HNB Bronze' },
        { level: 'U15', value: 1.69, confidence: 'published', source: 'HNB Gold' },
        { level: 'U15', value: 1.79, confidence: 'published', source: 'HNB Silver' },
        { level: 'U15', value: 1.89, confidence: 'published', source: 'HNB Bronze' },
        { level: 'U16', value: 1.60, confidence: 'published', source: 'HNB Gold' },
        { level: 'U16', value: 1.74, confidence: 'published', source: 'HNB Silver' },
        { level: 'U16', value: 1.79, confidence: 'published', source: 'HNB Bronze' },
        { level: 'HC Junior', value: 1.60, confidence: 'published', source: 'Hockey Canada' },
      ],
    },

    vertical_jump: {
      unit: 'in',
      lowerIsBetter: false,
      label: 'Vertical Jump',
      note: 'Arm swing. Gold standard per level.',
      levels: [
        { level: 'U14', value: 31, confidence: 'published', source: 'HNB Gold' },
        { level: 'U14', value: 22, confidence: 'published', source: 'HNB Silver' },
        { level: 'U14', value: 20, confidence: 'published', source: 'HNB Bronze' },
        { level: 'U15', value: 26.5, confidence: 'published', source: 'HNB Gold' },
        { level: 'U15', value: 24.5, confidence: 'published', source: 'HNB Silver' },
        { level: 'U15', value: 22.5, confidence: 'published', source: 'HNB Bronze' },
        { level: 'U16', value: 30, confidence: 'published', source: 'HNB Gold' },
        { level: 'U16', value: 27, confidence: 'published', source: 'HNB Silver' },
        { level: 'U16', value: 24, confidence: 'published', source: 'HNB Bronze' },
        { level: 'HC Junior', value: 30, confidence: 'published', source: 'Hockey Canada' },
      ],
    },

    broad_jump: {
      unit: 'm',
      lowerIsBetter: false,
      label: 'Broad Jump',
      note: 'Converted to meters. HC Junior target is aspirational mid-level marker.',
      levels: [
        { level: 'HC Junior', value: 2.90, confidence: 'published', source: 'Hockey Canada — 2.90m' },
      ],
    },

    pull_ups: {
      unit: 'reps',
      lowerIsBetter: false,
      label: 'Pull-Ups',
      note: 'Cadence 50bpm protocol for AAA estimates.',
      levels: [
        { level: 'U14', value: 14, confidence: 'published', source: 'HNB Gold' },
        { level: 'U14', value: 10, confidence: 'published', source: 'HNB Silver' },
        { level: 'U14', value: 6, confidence: 'published', source: 'HNB Bronze' },
        { level: 'U15', value: 18, confidence: 'published', source: 'HNB Gold' },
        { level: 'U15', value: 13, confidence: 'published', source: 'HNB Silver' },
        { level: 'U15', value: 8, confidence: 'published', source: 'HNB Bronze' },
        { level: 'U16', value: 20, confidence: 'published', source: 'HNB Gold' },
        { level: 'U16', value: 15, confidence: 'published', source: 'HNB Silver' },
        { level: 'U16', value: 10, confidence: 'published', source: 'HNB Bronze' },
        { level: 'HC Junior', value: 15, confidence: 'published', source: 'Hockey Canada' },
      ],
    },

    squat: {
      unit: 'lbs',
      lowerIsBetter: false,
      label: 'Squat e1RM',
      note: 'e1RM in lbs. Relative targets shown alongside absolute.',
      levels: [],
    },

    bench_press: {
      unit: 'lbs',
      lowerIsBetter: false,
      label: 'Bench Press e1RM',
      note: 'e1RM in lbs. Relative targets shown alongside absolute.',
      levels: [],
    },

    trap_bar_deadlift: {
      unit: 'lbs',
      lowerIsBetter: false,
      label: 'Trap Bar Deadlift',
      note: 'No published hockey standard exists. PFA working targets only — relative to bodyweight.',
      relativeOnly: true,
      levels: [],
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
        { level: 'U14', value: 5.00, confidence: 'published', source: 'HNB Gold' },
        { level: 'U14', value: 5.20, confidence: 'published', source: 'HNB Silver' },
        { level: 'U14', value: 5.40, confidence: 'published', source: 'HNB Bronze' },
        { level: 'U15', value: 4.75, confidence: 'published', source: 'HNB Gold' },
        { level: 'U15', value: 4.90, confidence: 'published', source: 'HNB Silver' },
        { level: 'U15', value: 5.05, confidence: 'published', source: 'HNB Bronze' },
        { level: 'U16', value: 4.70, confidence: 'published', source: 'HNB Gold' },
        { level: 'U16', value: 4.85, confidence: 'published', source: 'HNB Silver' },
        { level: 'U16', value: 5.00, confidence: 'published', source: 'HNB Bronze' },
        { level: 'HC Junior', value: 4.75, confidence: 'published', source: 'Hockey Canada' },
      ],
    },

    beep_test: {
      unit: 'level',
      lowerIsBetter: false,
      label: 'Beep Test',
      note: 'Gold standard per level.',
      levels: [
        { level: 'U14', value: 13.01, confidence: 'published', source: 'HNB Gold' },
        { level: 'U14', value: 12.01, confidence: 'published', source: 'HNB Silver' },
        { level: 'U14', value: 11.01, confidence: 'published', source: 'HNB Bronze' },
        { level: 'U15', value: 13.07, confidence: 'published', source: 'HNB Gold' },
        { level: 'U15', value: 12.07, confidence: 'published', source: 'HNB Silver' },
        { level: 'U15', value: 11.07, confidence: 'published', source: 'HNB Bronze' },
        { level: 'U16', value: 14.01, confidence: 'published', source: 'HNB Gold' },
        { level: 'U16', value: 13.01, confidence: 'published', source: 'HNB Silver' },
        { level: 'U16', value: 12.01, confidence: 'published', source: 'HNB Bronze' },
        { level: 'HC Junior', value: 14.01, confidence: 'published', source: 'Hockey Canada' },
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
        { level: 'U14', value: 1.85, confidence: 'published', source: 'HNB Gold' },
        { level: 'U14', value: 1.92, confidence: 'published', source: 'HNB Silver' },
        { level: 'U14', value: 1.99, confidence: 'published', source: 'HNB Bronze' },
        { level: 'U16', value: 1.80, confidence: 'published', source: 'HNB Gold' },
        { level: 'U16', value: 1.87, confidence: 'published', source: 'HNB Silver' },
        { level: 'U16', value: 1.96, confidence: 'published', source: 'HNB Bronze' },
        { level: 'HC FU18', value: 1.75, confidence: 'published', source: 'Hockey Canada' },
      ],
    },

    vertical_jump: {
      unit: 'in',
      lowerIsBetter: false,
      label: 'Vertical Jump',
      note: 'Arm swing equivalent. Gold standard per level.',
      levels: [
        { level: 'U14', value: 22, confidence: 'published', source: 'HNB Gold' },
        { level: 'U14', value: 20, confidence: 'published', source: 'HNB Silver' },
        { level: 'U14', value: 18, confidence: 'published', source: 'HNB Bronze' },
        { level: 'U16', value: 23, confidence: 'published', source: 'HNB Gold' },
        { level: 'U16', value: 21, confidence: 'published', source: 'HNB Silver' },
        { level: 'U16', value: 19, confidence: 'published', source: 'HNB Bronze' },
        { level: 'HC FU18', value: 24, confidence: 'published', source: 'Hockey Canada — 61cm' },
      ],
    },

    broad_jump: {
      unit: 'm',
      lowerIsBetter: false,
      label: 'Broad Jump',
      note: 'Converted to meters.',
      levels: [
        { level: 'HC FU18', value: 2.05, confidence: 'published', source: 'Hockey Canada — 2.05m' },
      ],
    },

    pull_ups: {
      unit: 'reps',
      lowerIsBetter: false,
      label: 'Pull-Ups',
      levels: [
        { level: 'U14', value: 6, confidence: 'published', source: 'HNB Gold' },
        { level: 'U14', value: 4, confidence: 'published', source: 'HNB Silver' },
        { level: 'U14', value: 2, confidence: 'published', source: 'HNB Bronze' },
        { level: 'U16', value: 9, confidence: 'published', source: 'HNB Gold' },
        { level: 'U16', value: 6, confidence: 'published', source: 'HNB Silver' },
        { level: 'U16', value: 3, confidence: 'published', source: 'HNB Bronze' },
        { level: 'HC FU18', value: 6, confidence: 'published', source: 'Hockey Canada' },
      ],
    },

    squat: {
      unit: 'lbs',
      lowerIsBetter: false,
      label: 'Squat e1RM',
      note: 'Limited published data. PFA relative targets used below U18.',
      levels: [],
    },

    bench_press: {
      unit: 'lbs',
      lowerIsBetter: false,
      label: 'Bench Press e1RM',
      note: 'Limited published data. PFA relative targets used below elite.',
      levels: [],
    },

    trap_bar_deadlift: {
      unit: 'lbs',
      lowerIsBetter: false,
      label: 'Trap Bar Deadlift',
      note: 'No published standard at any level. PFA working targets only.',
      relativeOnly: true,
      levels: [],
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
        { level: 'U14', value: 5.30, confidence: 'published', source: 'HNB Gold' },
        { level: 'U14', value: 5.45, confidence: 'published', source: 'HNB Silver' },
        { level: 'U14', value: 5.60, confidence: 'published', source: 'HNB Bronze' },
        { level: 'U16', value: 5.10, confidence: 'published', source: 'HNB Gold' },
        { level: 'U16', value: 5.30, confidence: 'published', source: 'HNB Silver' },
        { level: 'U16', value: 5.50, confidence: 'published', source: 'HNB Bronze' },
        { level: 'HC FU18', value: 5.20, confidence: 'published', source: 'Hockey Canada' },
      ],
    },

    beep_test: {
      unit: 'level',
      lowerIsBetter: false,
      label: 'Beep Test',
      note: 'Gold standard per level.',
      levels: [
        { level: 'U14', value: 10.01, confidence: 'published', source: 'HNB Gold' },
        { level: 'U14', value: 9.01, confidence: 'published', source: 'HNB Silver' },
        { level: 'U14', value: 8.01, confidence: 'published', source: 'HNB Bronze' },
        { level: 'U16', value: 11.01, confidence: 'published', source: 'HNB Gold' },
        { level: 'U16', value: 10.01, confidence: 'published', source: 'HNB Silver' },
        { level: 'U16', value: 9.01, confidence: 'published', source: 'HNB Bronze' },
        { level: 'HC FU18', value: 11.01, confidence: 'published', source: 'Hockey Canada' },
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
