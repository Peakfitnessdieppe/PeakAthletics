export const formatRole = (role) => {
  const labels = {
    pfa_admin: 'PFA Admin',
    pfa_staff: 'PFA Staff',
    team_coach: 'Team Coach',
    athlete: 'Athlete',
    family: 'Family',
  }
  return labels[role] || role
}
