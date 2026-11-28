import { useEffect, useState, type ReactNode } from 'react'
import { request } from '../api'
import { SessionContext, type User } from '../session'

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null | undefined>(undefined)

  useEffect(() => {
    request<User>('/auth/me').then(setUser, () => setUser(null))
  }, [])

  async function logout() {
    await request('/auth/logout', { method: 'POST' })
    setUser(null)
  }

  return <SessionContext value={{ user, setUser, logout }}>{children}</SessionContext>
}
