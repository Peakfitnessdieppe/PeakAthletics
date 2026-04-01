import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../services/supabase'
import { useTheme } from './ThemeContext'

const AuthContext = createContext({
  user: null,
  profile: null,
  team: null,
  loading: true,
  signOut: async () => {},
})

const fetchProfileAndTeam = async (userId, setTeamTheme) => {
  try {
    const fetchWithTimeout = (promise, ms = 5000) =>
      Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Query timeout')), ms)),
      ])

    console.log('[Auth] Fetching profile for user', userId)
    const { data: profile, error: profileError } = await fetchWithTimeout(
      supabase.from('profiles').select('*').eq('id', userId).single()
    )

    if (profileError || !profile) {
      console.warn('[Auth] Profile fetch error or empty', profileError)
      if (!profile && userId) {
        const { data: newProfile, error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: userId,
            role: 'athlete',
            full_name: 'New Athlete',
            email: '',
          })
          .select()
          .single()

        if (!insertError && newProfile) {
          console.log('[Auth] Created new profile for OAuth user', userId)
          return { profile: newProfile, team: null }
        }
      }
      return { profile: null, team: null }
    }

    let team = null
    if (profile?.team_id) {
      const { data: teamData, error: teamError } = await supabase
        .from('pfa_teams')
        .select('id, name, sport, primary_color, secondary_color')
        .eq('id', profile.team_id)
        .single()

      if (!teamError) {
        team = teamData
        if (team?.primary_color || team?.secondary_color) {
          setTeamTheme({
            name: team?.name,
            primary: team?.primary_color,
            secondary: team?.secondary_color,
          })
        }
      }
    }

    console.log('[Auth] Profile fetched', profile)
    return { profile, team }
  } catch (error) {
    console.warn('Profile fetch skipped or failed', error?.message)
    return { profile: null, team: null }
  }
}

export const AuthProvider = ({ children }) => {
  const { setTeamTheme } = useTheme()
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [team, setTeam] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    let currentUserId = null

    const getSession = async () => {
      console.log('[Auth] Getting session')
      const { data, error } = await supabase.auth.getSession()
      if (error) {
        console.error('Session error', error)
      }
      const sessionUser = data?.session?.user ?? null
      console.log('[Auth] Session user', sessionUser)
      if (mounted) setUser(sessionUser)

      if (sessionUser) {
        currentUserId = sessionUser.id
        const { profile: fetchedProfile, team: fetchedTeam } = await fetchProfileAndTeam(
          sessionUser.id,
          setTeamTheme
        )
        if (mounted) {
          setProfile(fetchedProfile)
          setTeam(fetchedTeam)
        }
      }
      if (mounted) setLoading(false)
    }

    getSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[Auth] Auth state change', event, session)
      const sessionUser = session?.user ?? null

      if (event === 'SIGNED_OUT') {
        currentUserId = null
        setUser(null)
        setProfile(null)
        setTeam(null)
        setLoading(false)
        return
      }

      setUser(sessionUser)

      if (sessionUser?.id && sessionUser.id !== currentUserId) {
        currentUserId = sessionUser.id
        const { profile: fetchedProfile, team: fetchedTeam } = await fetchProfileAndTeam(
          sessionUser.id,
          setTeamTheme
        )
        setProfile(fetchedProfile)
        setTeam(fetchedTeam)
      }

      setLoading(false)
    })

    return () => {
      mounted = false
      subscription?.unsubscribe()
    }
  }, [setTeamTheme])

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
    setTeam(null)
  }

  return (
    <AuthContext.Provider value={{ user, profile, team, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuthContext = () => useContext(AuthContext)

export default AuthContext
