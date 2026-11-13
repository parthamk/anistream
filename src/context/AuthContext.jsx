
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState
} from 'react'

import {
  supabase,
  isSupabaseConfigured
} from '../lib/supabaseClient'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = useCallback(async (userId) => {
    if (!supabase || !userId) {
      setProfile(null)
      return null
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, is_admin, created_at')
      .eq('id', userId)
      .maybeSingle()

    if (error) {
      console.error('Profile fetch failed:', error.message)
      setProfile(null)
      return null
    }

    setProfile(data)
    return data
  }, [])

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false)
      return undefined
    }

    let mounted = true

    async function initializeAuth() {
      const { data, error } = await supabase.auth.getSession()

      if (!mounted) return

      if (error) {
        console.error('Session initialization failed:', error.message)
      }

      const currentSession = data?.session ?? null

      setSession(currentSession)
      setUser(currentSession?.user ?? null)

      if (currentSession?.user) {
        await fetchProfile(currentSession.user.id)
      } else {
        setProfile(null)
      }

      if (mounted) {
        setLoading(false)
      }
    }

    initializeAuth()

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!mounted) return

      setSession(newSession)
      setUser(newSession?.user ?? null)

      if (!newSession?.user) {
        setProfile(null)
        setLoading(false)
        return
      }

      Promise.resolve().then(async () => {
        if (!mounted) return

        await fetchProfile(newSession.user.id)

        if (mounted) {
          setLoading(false)
        }
      })
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [fetchProfile])

  const signUp = useCallback(async (email, password, username) => {
    if (!supabase) {
      throw new Error('Authentication is not configured.')
    }

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          username: username.trim()
        }
      }
    })

    if (error) throw error

    if (!data.session) {
      return {
        data,
        message: 'Account created! Please check your inbox to confirm your email before logging in.',
        requiresEmailConfirmation: true
      }
    }

    return {
      data,
      message: 'Your account has been created successfully.',
      requiresEmailConfirmation: false
    }
  }, [])

  const signIn = useCallback(async (email, password) => {
    if (!supabase) {
      throw new Error('Authentication is not configured.')
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password
    })

    if (error) throw error

    return data
  }, [])

  const signOut = useCallback(async () => {
    if (!supabase) {
      throw new Error('Authentication is not configured.')
    }

    const { error } = await supabase.auth.signOut()

    if (error) throw error

    setSession(null)
    setUser(null)
    setProfile(null)
  }, [])

  const value = {
    session,
    user,
    profile,
    loading,
    signUp,
    signIn,
    signOut,
    refreshProfile: () => user ? fetchProfile(user.id) : null
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error(
      'useAuth must be used inside an AuthProvider.'
    )
  }

  return context
}
