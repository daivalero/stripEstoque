import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from '@/services/supabase'
import type { Profile, UserRole } from '@/types'

const DEMO_STORAGE_KEY = 'estoque_demo_session'

interface AuthContextValue {
  session: Session | null
  user: User | null
  profile: Profile | null
  loading: boolean
  isConfigured: boolean
  isDemo: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  enterDemo: () => void
  signOut: () => Promise<void>
  displayName: string
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

function buildFallbackProfile(user: User): Profile {
  const email = user.email ?? ''
  const fullName =
    (user.user_metadata?.full_name as string | undefined) ||
    (user.user_metadata?.nome as string | undefined) ||
    email.split('@')[0] ||
    'Usuário'

  return {
    id: user.id,
    email,
    full_name: fullName,
    role: 'operador' as UserRole,
  }
}

function createDemoSession(): { session: Session; profile: Profile } {
  const profile: Profile = {
    id: 'demo-user',
    email: 'demo@estoque.local',
    full_name: 'Davi',
    role: 'admin',
  }

  const user = {
    id: profile.id,
    email: profile.email,
    app_metadata: {},
    user_metadata: { full_name: profile.full_name },
    aud: 'authenticated',
    created_at: new Date().toISOString(),
  } as User

  const session = {
    access_token: 'demo',
    refresh_token: 'demo',
    expires_in: 3600,
    token_type: 'bearer',
    user,
  } as Session

  return { session, profile }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [isDemo, setIsDemo] = useState(false)

  const loadProfile = useCallback(async (user: User) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, role, meta_individual')
        .eq('id', user.id)
        .maybeSingle()

      if (error || !data) {
        setProfile(buildFallbackProfile(user))
        return
      }

      setProfile(data as Profile)
    } catch {
      setProfile(buildFallbackProfile(user))
    }
  }, [])

  useEffect(() => {
    let mounted = true

    async function init() {
      if (!isSupabaseConfigured) {
        const demoActive = localStorage.getItem(DEMO_STORAGE_KEY) === '1'
        if (demoActive && mounted) {
          const demo = createDemoSession()
          setSession(demo.session)
          setProfile(demo.profile)
          setIsDemo(true)
        }
        if (mounted) setLoading(false)
        return
      }

      const { data } = await supabase.auth.getSession()
      if (!mounted) return

      setSession(data.session)
      if (data.session?.user) {
        await loadProfile(data.session.user)
      }
      if (mounted) setLoading(false)
    }

    void init()

    if (!isSupabaseConfigured) {
      return () => {
        mounted = false
      }
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setIsDemo(false)
      if (nextSession?.user) {
        void loadProfile(nextSession.user)
      } else {
        setProfile(null)
      }
      setLoading(false)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [loadProfile])

  const signIn = useCallback(async (email: string, password: string) => {
    if (!isSupabaseConfigured) {
      return {
        error:
          'Supabase não configurado. Use “Pré-visualizar interface” ou preencha o .env',
      }
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (error) {
      if (error.message.toLowerCase().includes('invalid login')) {
        return { error: 'Email ou senha incorretos.' }
      }
      return { error: error.message }
    }

    return { error: null }
  }, [])

  const enterDemo = useCallback(() => {
    const demo = createDemoSession()
    localStorage.setItem(DEMO_STORAGE_KEY, '1')
    setIsDemo(true)
    setSession(demo.session)
    setProfile(demo.profile)
  }, [])

  const signOut = useCallback(async () => {
    localStorage.removeItem(DEMO_STORAGE_KEY)
    setIsDemo(false)
    if (isSupabaseConfigured) {
      await supabase.auth.signOut()
    }
    setProfile(null)
    setSession(null)
  }, [])

  const displayName = useMemo(() => {
    if (profile?.full_name?.trim()) return profile.full_name
    if (session?.user?.email) return session.user.email.split('@')[0]
    return 'Usuário'
  }, [profile, session])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      loading,
      isConfigured: isSupabaseConfigured,
      isDemo,
      signIn,
      enterDemo,
      signOut,
      displayName,
    }),
    [session, profile, loading, isDemo, signIn, enterDemo, signOut, displayName],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider')
  }
  return context
}
