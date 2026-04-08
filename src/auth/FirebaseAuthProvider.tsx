import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  createUserWithEmailAndPassword,
  getAuth,
  inMemoryPersistence,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth'
import { getFirebaseApp, isFirebaseConfigured } from '../sync/firebaseApp'
import { useStore } from '../store'

type AuthCtx = {
  user: User | null
  loading: boolean
  signInWithPassword: (email: string, password: string) => Promise<void>
  registerWithPassword: (email: string, password: string) => Promise<void>
  signOutUser: () => Promise<void>
}

const Ctx = createContext<AuthCtx | null>(null)

export function FirebaseAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setLoading(false)
      return
    }
    const auth = getAuth(getFirebaseApp())
    void setPersistence(auth, inMemoryPersistence)

    return onAuthStateChanged(auth, u => {
      setUser(u)
      setLoading(false)
    })
  }, [])

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    const auth = getAuth(getFirebaseApp())
    await setPersistence(auth, inMemoryPersistence)
    await signInWithEmailAndPassword(auth, email.trim(), password)
  }, [])

  const registerWithPassword = useCallback(async (email: string, password: string) => {
    const auth = getAuth(getFirebaseApp())
    await setPersistence(auth, inMemoryPersistence)
    await createUserWithEmailAndPassword(auth, email.trim(), password)
  }, [])

  const signOutUser = useCallback(async () => {
    try {
      useStore.getState().setSyncWorkspaceId(null)
    } catch {
      /* ignore */
    }
    if (isFirebaseConfigured()) {
      await signOut(getAuth(getFirebaseApp()))
    }
  }, [])

  const value = useMemo<AuthCtx>(
    () => ({
      user,
      loading,
      signInWithPassword,
      registerWithPassword,
      signOutUser,
    }),
    [user, loading, signInWithPassword, registerWithPassword, signOutUser]
  )

  if (!isFirebaseConfigured()) {
    return (
      <Ctx.Provider
        value={{
          user: null,
          loading: false,
          signInWithPassword: async () => {},
          registerWithPassword: async () => {},
          signOutUser: async () => {},
        }}
      >
        {children}
      </Ctx.Provider>
    )
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useFirebaseAuth(): AuthCtx {
  const v = useContext(Ctx)
  if (!v) {
    return {
      user: null,
      loading: false,
      signInWithPassword: async () => {},
      registerWithPassword: async () => {},
      signOutUser: async () => {},
    }
  }
  return v
}
