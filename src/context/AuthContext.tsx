import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User } from '../types';
import { api, setAuthToken, getAuthToken } from '../services/api';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  unreadBadge: number;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, nickname: string) => Promise<void>;
  logout: () => void;
  refreshBadge: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [unreadBadge, setUnreadBadge] = useState(0);

  const refreshBadge = useCallback(async () => {
    if (!getAuthToken()) return;
    try {
      const res = await api.getBadgeCount();
      setUnreadBadge(res.unreadCount);
    } catch {
      // ignore
    }
  }, []);

  const refreshUser = useCallback(async () => {
    const token = getAuthToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const me = await api.getMe();
      setUser(me);
      await refreshBadge();
    } catch {
      setAuthToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [refreshBadge]);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  // Periodic badge poll
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      refreshBadge();
    }, 5000);
    return () => clearInterval(interval);
  }, [user, refreshBadge]);

  const login = async (username: string, password: string) => {
    const res = await api.login({ username, password });
    setAuthToken(res.token);
    setUser(res.user);
    await refreshBadge();
  };

  const register = async (username: string, password: string, nickname: string) => {
    const res = await api.register({ username, password, nickname });
    setAuthToken(res.token);
    setUser(res.user);
    await refreshBadge();
  };

  const logout = () => {
    setAuthToken(null);
    setUser(null);
    setUnreadBadge(0);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        unreadBadge,
        login,
        register,
        logout,
        refreshBadge,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
