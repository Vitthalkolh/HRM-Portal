import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { sessionStore, setSessionEndedHandler, type Session } from '../api/client';
import { authApi } from '../api/services';
import type { User } from '../api/types';

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  /** True until the stored session has been checked against the server on first load. */
  initialising: boolean;
  signIn: (login: string, password: string, rememberMe: boolean) => Promise<User>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const homePathFor = (user: User | null) =>
  user?.role === 'Admin' ? '/admin/dashboard' : '/employee/dashboard';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => sessionStore.read()?.user ?? null);
  const [initialising, setInitialising] = useState(true);

  const clearSession = useCallback(() => {
    sessionStore.clear();
    setUser(null);
  }, []);

  // The API client ends the session when a refresh fails; the UI follows it.
  useEffect(() => {
    setSessionEndedHandler(clearSession);
  }, [clearSession]);

  // A stored session is only trusted once the server confirms it, so a revoked or expired
  // session cannot leave a stale name and role on screen.
  useEffect(() => {
    let cancelled = false;

    const verify = async () => {
      if (!sessionStore.read()) {
        setInitialising(false);
        return;
      }

      try {
        const current = await authApi.me();
        if (!cancelled) {
          setUser(current);
          const session = sessionStore.read();
          if (session) sessionStore.write({ ...session, user: current });
        }
      } catch {
        if (!cancelled) clearSession();
      } finally {
        if (!cancelled) setInitialising(false);
      }
    };

    void verify();
    return () => {
      cancelled = true;
    };
  }, [clearSession]);

  // Signing out in one tab signs out the others.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'hrm.session' && event.newValue === null) setUser(null);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const signIn = useCallback(async (login: string, password: string, rememberMe: boolean) => {
    const token = await authApi.login(login, password, rememberMe);
    const session: Session = {
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
      expiresAtUtc: token.expiresAtUtc,
      user: token.user,
    };
    sessionStore.write(session);
    setUser(token.user);
    return token.user;
  }, []);

  const signOut = useCallback(async () => {
    const session = sessionStore.read();
    try {
      // Revoke the refresh token server-side; the local session is cleared either way.
      if (session?.refreshToken) await authApi.logout(session.refreshToken);
    } catch {
      /* Signing out must always succeed from the user's point of view. */
    } finally {
      clearSession();
    }
  }, [clearSession]);

  const refreshUser = useCallback(async () => {
    try {
      const current = await authApi.me();
      setUser(current);
      const session = sessionStore.read();
      if (session) sessionStore.write({ ...session, user: current });
    } catch {
      clearSession();
    }
  }, [clearSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      isAdmin: user?.role === 'Admin',
      initialising,
      signIn,
      signOut,
      refreshUser,
    }),
    [user, initialising, signIn, signOut, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside an AuthProvider.');
  return context;
}
