import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, getStoredToken, setStoredToken } from '../services/api';
import { registerForPushNotificationsAsync } from '../services/notifications';
import { UserProfile } from '../types';

interface AuthContextValue {
  user: UserProfile | null;
  loading: boolean;
  unreadCount: number;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (payload: {
    fullName: string;
    email: string;
    phone: string;
    password: string;
  }) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setUserDirect: (user: UserProfile) => void;
  setUnreadCount: (count: number) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const syncPushToken = useCallback(async () => {
    const pushToken = await registerForPushNotificationsAsync();
    if (pushToken) {
      await api.registerPushToken(pushToken).catch(() => undefined);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const [{ user: profile }, notifRes] = await Promise.all([
        api.getProfile(),
        api.getNotifications(),
      ]);
      setUser(profile);
      setUnreadCount(notifRes.unreadCount);
    } catch {
      await setStoredToken(null);
      setUser(null);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const token = await getStoredToken();
      if (token) {
        await refreshUser();
      }
      setLoading(false);
    })();
  }, [refreshUser]);

  const signIn = async (email: string, password: string) => {
    const res = await api.login({ email, password });
    await setStoredToken(res.token);
    setUser(res.user);
    const notifRes = await api.getNotifications().catch(() => ({ unreadCount: 0 }));
    setUnreadCount(notifRes.unreadCount);
    syncPushToken();
  };

  const signUp = async (payload: {
    fullName: string;
    email: string;
    phone: string;
    password: string;
  }) => {
    const res = await api.register(payload);
    await setStoredToken(res.token);
    setUser(res.user);
    const notifRes = await api.getNotifications().catch(() => ({ unreadCount: 1 }));
    setUnreadCount(notifRes.unreadCount);
    syncPushToken();
  };

  const signOut = async () => {
    await setStoredToken(null);
    setUser(null);
    setUnreadCount(0);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        unreadCount,
        signIn,
        signUp,
        signOut,
        refreshUser,
        setUserDirect: setUser,
        setUnreadCount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
