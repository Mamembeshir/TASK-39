import type { PropsWithChildren } from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { setOnUnauthorized } from '@/api/client';
import { login as loginRequest, logout as logoutRequest, me as meRequest, refresh as refreshRequest, register as registerRequest } from '@/features/auth/api/authApi';
import type { AuthUser, LoginInput, RegisterInput } from '@/features/auth/api/authApi';

type AuthContextValue = {
  user: AuthUser | null;
  roles: string[];
  login: (input: LoginInput) => Promise<void>;
  logout: () => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  refresh: () => Promise<boolean>;
  isLoading: boolean;
};

export type AuthRole = 'moderator' | 'administrator';

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadMe = useCallback(async () => {
    const { user: currentUser } = await meRequest();
    setUser(currentUser);
    return currentUser;
  }, []);

  const refresh = useCallback(async () => {
    try {
      await refreshRequest();
      await loadMe();
      return true;
    } catch {
      setUser(null);
      return false;
    }
  }, [loadMe]);

  const logout = useCallback(async () => {
    try {
      await logoutRequest();
    } finally {
      setUser(null);
    }
  }, []);

  const login = useCallback(async (input: LoginInput) => {
    await loginRequest(input);
    await loadMe();
  }, [loadMe]);

  const register = useCallback(async (input: RegisterInput) => {
    await registerRequest(input);
    await loadMe();
  }, [loadMe]);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const ok = await refresh();
      if (!cancelled) {
        setIsLoading(false);
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  useEffect(() => {
    setOnUnauthorized(() => {
      void refresh().then((ok) => {
        if (!ok) {
          void logout();
        }
      });
    });

    return () => setOnUnauthorized(null);
  }, [logout, refresh]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      roles: user?.roles ?? [],
      login,
      logout,
      register,
      refresh,
      isLoading,
    }),
    [isLoading, login, logout, refresh, register, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within AuthProvider');
  return value;
}

export function hasRole(roles: string[], allowed: AuthRole[]) {
  return roles.some((role) => allowed.includes(role as AuthRole));
}
