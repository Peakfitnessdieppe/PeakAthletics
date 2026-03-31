import React, { createContext, useContext, useEffect, useState } from 'react'

const PFA_DEFAULT_THEME = {
  name: 'Peak Fitness Athletics',
  primary: '#3fae52',
  secondary: '#0a0f0a',
}

const ThemeContext = createContext({
  teamTheme: PFA_DEFAULT_THEME,
  setTeamTheme: () => {},
})

const applyThemeToDocument = (theme) => {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.style.setProperty('--team-primary', theme?.primary ?? PFA_DEFAULT_THEME.primary)
  root.style.setProperty('--team-secondary', theme?.secondary ?? PFA_DEFAULT_THEME.secondary)
}

export const ThemeProvider = ({ children }) => {
  const [teamTheme, setTeamThemeState] = useState(PFA_DEFAULT_THEME)

  const setTeamTheme = (theme) => {
    const nextTheme = {
      name: theme?.name ?? PFA_DEFAULT_THEME.name,
      primary: theme?.primary ?? PFA_DEFAULT_THEME.primary,
      secondary: theme?.secondary ?? PFA_DEFAULT_THEME.secondary,
    }
    setTeamThemeState(nextTheme)
    applyThemeToDocument(nextTheme)
  }

  useEffect(() => {
    applyThemeToDocument(PFA_DEFAULT_THEME)
  }, [])

  return (
    <ThemeContext.Provider value={{ teamTheme, setTeamTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)

export default ThemeContext
