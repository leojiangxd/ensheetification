import { createContext, useContext } from 'react'

export type User = { id: string; name: string; email: string }

export type Session = {
  /** undefined while the first /auth/me check is in flight, null when logged out */
  user: User | null | undefined
  setUser: (user: User | null) => void
  logout: () => Promise<void>
}

export const SessionContext = createContext<Session | null>(null)

export function useSession() {
  const session = useContext(SessionContext)
  if (!session) throw new Error('useSession must be used inside SessionProvider')
  return session
}
