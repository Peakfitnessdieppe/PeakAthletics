export const TEST_CATEGORIES = [
  {
    category: 'speed',
    label: 'Speed',
    tests: [
      { id: '10m_sprint', name: '10m Sprint', unit: 'sec', higherIsBetter: false },
      { id: '30m_sprint', name: '30m Sprint', unit: 'sec', higherIsBetter: false },
    ],
  },
  {
    category: 'strength',
    label: 'Strength',
    tests: [
      { id: 'push_ups', name: 'Push Ups', unit: 'reps', higherIsBetter: true },
      { id: 'pull_ups', name: 'Pull Ups', unit: 'reps', higherIsBetter: true },
      { id: 'squat', name: 'Squat', unit: 'kg', higherIsBetter: true },
      { id: 'trap_bar_deadlift', name: 'Trap Bar Deadlift', unit: 'kg', higherIsBetter: true },
      { id: 'bench_press', name: 'Bench Press', unit: 'kg', higherIsBetter: true },
    ],
  },
  {
    category: 'power',
    label: 'Power',
    tests: [
      { id: 'broad_jump', name: 'Broad Jump', unit: 'm', higherIsBetter: true },
      { id: 'vertical_jump', name: 'Vertical Jump', unit: 'cm', higherIsBetter: true },
      { id: 'ncmj', name: 'NCMJ', unit: 'cm', higherIsBetter: true },
    ],
  },
  {
    category: 'agility',
    label: 'Agility',
    tests: [
      { id: 'pro_agility_shuttle', name: 'Pro Agility Shuttle', unit: 'sec', higherIsBetter: false },
    ],
  },
  {
    category: 'endurance',
    label: 'Endurance',
    tests: [
      { id: 'beep_test', name: 'Beep Test', unit: 'level', higherIsBetter: true },
    ],
  },
]

export const ALL_TESTS = TEST_CATEGORIES.flatMap((c) => c.tests)
export const getTest = (id) => ALL_TESTS.find((t) => t.id === id)
