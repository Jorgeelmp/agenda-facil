import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { authApi, decodeToken, setUnauthorizedHandler, tokenStorage } from '../services/api'

const AuthContext = createContext(null)

function readValidToken() {
  const token = tokenStorage.get()
  if (!token) return null
  const payload = decodeToken(token)
  if (!payload || payload.exp * 1000 <= Date.now()) {
    tokenStorage.clear()
    return null
  }
  return token
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(readValidToken)

  const logout = useCallback(() => {
    tokenStorage.clear()
    setToken(null)
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(logout)
  }, [logout])

  const login = useCallback(async (email, senha) => {
    const { token: novoToken } = await authApi.login(email, senha)
    tokenStorage.set(novoToken)
    setToken(novoToken)
  }, [])

  const value = useMemo(() => {
    const payload = token ? decodeToken(token) : null
    return {
      token,
      payload,
      isAuthenticated: Boolean(token),
      login,
      logout,
      register: authApi.register,
    }
  }, [token, login, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
