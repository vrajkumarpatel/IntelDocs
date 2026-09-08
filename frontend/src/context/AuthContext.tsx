import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { login as apiLogin, register as apiRegister, setUnauthorizedHandler } from '../lib/api'
import { roleFromToken } from '../lib/jwt'
import { clearToken, getToken, setToken } from '../lib/token'
import type { LoginRequest, RegisterRequest, UserRole } from '../types'

interface AuthContextValue {
  isAuthenticated: boolean
  /** UI display hint only — the API is the real enforcement point. */
  role: UserRole | null
  login: (payload: LoginRequest) => Promise<void>
  register: (payload: RegisterRequest) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() => getToken())

  const logout = useCallback(() => {
    clearToken()
    setTokenState(null)
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setTokenState(null)
    })
  }, [])

  const login = useCallback(async (payload: LoginRequest) => {
    const { access_token } = await apiLogin(payload)
    setToken(access_token)
    setTokenState(access_token)
  }, [])

  const register = useCallback(async (payload: RegisterRequest) => {
    const { access_token } = await apiRegister(payload)
    setToken(access_token)
    setTokenState(access_token)
  }, [])

  const role = useMemo(() => roleFromToken(token), [token])

  const value = useMemo<AuthContextValue>(
    () => ({ isAuthenticated: Boolean(token), role, login, register, logout }),
    [token, role, login, register, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
