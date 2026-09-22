import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { authApi } from '../api/endpoints'
import { TOKEN_KEY, USER_KEY, errorMessage } from '../api/client'

const AuthContext = createContext(null)

function readStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readStoredUser)

  const login = useCallback(async (userName, password) => {
    try {
      const { data } = await authApi.login(userName, password)

      localStorage.setItem(TOKEN_KEY, data.token)
      localStorage.setItem(USER_KEY, JSON.stringify(data))
      setUser(data)

      return { ok: true, user: data }
    } catch (error) {
      return { ok: false, message: errorMessage(error, 'Invalid username or password.') }
    }
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    setUser(null)
  }, [])

  const landingPath = user?.isAdmin ? '/admin/dashboard' : '/employee/dashboard'

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isAdmin: Boolean(user?.isAdmin),
      landingPath,
      login,
      logout,
    }),
    [user, login, logout, landingPath],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used inside an AuthProvider')
  }

  return context
}
