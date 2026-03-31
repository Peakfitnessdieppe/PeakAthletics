import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

const createStubClient = () => {
  const stubQuery = {
    select: () => stubQuery,
    eq: () => stubQuery,
    single: async () => ({ data: null, error: null }),
  }

  const stubSubscription = {
    unsubscribe: () => {},
  }

  return {
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      onAuthStateChange: (callback) => {
        callback('SIGNED_OUT', null)
        return { data: { subscription: stubSubscription } }
      },
      signOut: async () => ({ error: null }),
      signInWithPassword: async () => ({ error: new Error('Supabase not configured') }),
    },
    from: () => stubQuery,
  }
}

export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          storageKey: 'pfa-auth-token',
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
        },
      })
    : createStubClient()
