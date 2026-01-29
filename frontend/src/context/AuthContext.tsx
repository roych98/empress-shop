import {
  ReactNode,
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
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const AUTH_STORAGE_KEY = 'empress_auth';

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as {
          user: AuthUser;
          token: string;
        };
        setUser(parsed.user);
        setToken(parsed.token);
      } catch {
        localStorage.removeItem(AUTH_STORAGE_KEY);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (user && token) {
      localStorage.setItem(
        AUTH_STORAGE_KEY,
        JSON.stringify({ user, token }),
      );
    } else {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  }, [user, token]);

  const login = async (email: string, password: string) => {
    const response = await api.post('/auth/login', { email, password });
    const data = response.data as { token: string; user: AuthUser };
    setUser(data.user);
    setToken(data.token);
    localStorage.setItem('auth_token', data.token);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem(AUTH_STORAGE_KEY);
    localStorage.removeItem('auth_token');
  };

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      login,
      logout,
    }),
    [user, token, loading],
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

