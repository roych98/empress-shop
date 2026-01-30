import type { ReactNode } from 'react';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { api } from '../api/client';

export type UserRole = 'host' | 'runner' | 'viewer';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  isGuest: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  continueAsGuest: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const AUTH_STORAGE_KEY = 'empress_auth';

interface AuthProviderProps {
  children: ReactNode;
}

const GUEST_STORAGE_KEY = 'empress_guest';

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    const guestMode = localStorage.getItem(GUEST_STORAGE_KEY) === 'true';
    
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as {
          user: AuthUser;
          token: string;
        };
        setUser(parsed.user);
        setToken(parsed.token);
        setIsGuest(false);
      } catch {
        localStorage.removeItem(AUTH_STORAGE_KEY);
      }
    } else if (guestMode) {
      setIsGuest(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (user && token) {
      localStorage.setItem(
        AUTH_STORAGE_KEY,
        JSON.stringify({ user, token }),
      );
      localStorage.removeItem(GUEST_STORAGE_KEY);
      setIsGuest(false);
    } else if (isGuest) {
      localStorage.setItem(GUEST_STORAGE_KEY, 'true');
      localStorage.removeItem(AUTH_STORAGE_KEY);
    } else {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      localStorage.removeItem(GUEST_STORAGE_KEY);
    }
  }, [user, token, isGuest]);

  const login = async (email: string, password: string) => {
    const response = await api.post('/auth/login', { email, password });
    const data = response.data as { token: string; user: AuthUser };
    setUser(data.user);
    setToken(data.token);
    setIsGuest(false);
    localStorage.setItem('auth_token', data.token);
  };

  const continueAsGuest = () => {
    setUser(null);
    setToken(null);
    setIsGuest(true);
    localStorage.removeItem('auth_token');
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setIsGuest(false);
    localStorage.removeItem(AUTH_STORAGE_KEY);
    localStorage.removeItem('auth_token');
    localStorage.removeItem(GUEST_STORAGE_KEY);
  };

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      isGuest,
      login,
      logout,
      continueAsGuest,
    }),
    [user, token, loading, isGuest],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}

