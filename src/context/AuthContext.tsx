import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import axios from 'axios';
import type { PermissionRow } from '../shared/permissions';

interface User {
  id: number;
  username: string;
  role: 'Admin' | 'User';
  permissions?: PermissionRow[];
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User, rememberMe: boolean) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const clearStoredSession = () => {
  for (const storage of [localStorage, sessionStorage]) {
    storage.removeItem('token');
    storage.removeItem('user');
  }
};

function readStoredSession(): { token: string; user: User; storage: Storage } | null {
  for (const storage of [localStorage, sessionStorage]) {
    const token = storage.getItem('token');
    const user = storage.getItem('user');
    if (!token || !user) continue;
    try {
      return { token, user: JSON.parse(user), storage };
    } catch {
      clearStoredSession(); // corrupted entry: start clean rather than crash
      return null;
    }
  }
  return null;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const tokenRef = useRef<string | null>(null);
  tokenRef.current = token;

  // Every API request carries the current token.
  useEffect(() => {
    const interceptor = axios.interceptors.request.use(config => {
      if (tokenRef.current && config.url?.startsWith('/api/') && !config.headers.Authorization) {
        config.headers.Authorization = `Bearer ${tokenRef.current}`;
      }
      return config;
    });
    return () => axios.interceptors.request.eject(interceptor);
  }, []);

  useEffect(() => {
    const saved = readStoredSession();
    if (!saved) {
      setIsLoading(false);
      return;
    }
    setToken(saved.token);
    setUser(saved.user);
    // Refresh role and permissions: they may have changed since this session was saved.
    axios.get('/api/auth/me', { headers: { Authorization: `Bearer ${saved.token}` } })
      .then(res => {
        setUser(res.data.user);
        saved.storage.setItem('user', JSON.stringify(res.data.user));
      })
      .catch(() => { /* a 401 is handled by the response interceptor */ })
      .finally(() => setIsLoading(false));
  }, []);

  const login = (newToken: string, newUser: User, rememberMe: boolean) => {
    setToken(newToken);
    setUser(newUser);
    clearStoredSession();
    const storage = rememberMe ? localStorage : sessionStorage;
    storage.setItem('token', newToken);
    storage.setItem('user', JSON.stringify(newUser));
  };

  const endSession = () => {
    setToken(null);
    setUser(null);
    clearStoredSession();
  };

  const logout = () => {
    // Invalidate the token on the server too; clear locally whatever happens.
    if (tokenRef.current) axios.post('/api/logout').catch(() => {});
    endSession();
  };

  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401 && !error.config?.url?.startsWith('/api/login')) {
          endSession();
          if (window.location.pathname !== '/login') window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
    return () => axios.interceptors.response.eject(interceptor);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
