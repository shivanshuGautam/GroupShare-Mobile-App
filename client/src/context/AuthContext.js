import React, { createContext, useState, useEffect, useContext } from 'react';
import { authApi, notificationsApi } from '../services/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  // Check initial login state on app launch
  useEffect(() => {
    const bootstrap = async () => {
      try {
        const savedToken = await authApi.getToken();
        const savedUser = await authApi.getCurrentUser();
        if (savedToken && savedUser) {
          if (savedToken.startsWith('mock-jwt-token') || savedToken === 'demo-admin-token') {
            await authApi.logout();
            setUser(null);
            setToken(null);
            return;
          }
          setToken(savedToken);
          setUser(savedUser);
          // Refresh profile in background
          try {
            const profileRes = await authApi.getProfile();
            if (profileRes.user) setUser(profileRes.user);
          } catch (e) {
            if (e.message?.includes('Invalid') || e.message?.includes('401')) {
              await authApi.logout();
              setUser(null);
              setToken(null);
            }
          }
        }
      } catch (err) {
        if (__DEV__) {
          console.log('[AuthContext] Bootstrap auth load notice:', err?.message);
        }
      } finally {
        setIsLoading(false);
      }
    };

    bootstrap();
  }, []);

  // Poll notifications count periodically when logged in
  useEffect(() => {
    if (!token) return;
    const fetchNotifs = async () => {
      try {
        const res = await notificationsApi.getNotifications();
        if (res.success && res.unreadCount !== undefined) {
          setUnreadCount(res.unreadCount);
        }
      } catch (e) {
        // ignore
      }
    };

    fetchNotifs();
    const interval = setInterval(fetchNotifs, 15000); // 15 seconds
    return () => clearInterval(interval);
  }, [token]);

  const login = async (email, password) => {
    const res = await authApi.login(email, password);
    if (res.user && res.token) {
      setUser(res.user);
      setToken(res.token);
    }
    return res;
  };

  const register = async (userData) => {
    return await authApi.register(userData);
  };

  const verifyEmail = async (email, code) => {
    const res = await authApi.verifyEmail(email, code);
    if (res.user && res.token) {
      setUser(res.user);
      setToken(res.token);
    }
    return res;
  };

  const resendVerification = async (email) => {
    return await authApi.resendVerification(email);
  };

  const updateProfile = async (profileData) => {
    const res = await authApi.updateProfile(profileData);
    if (res.user) {
      setUser((prev) => ({ ...prev, ...res.user }));
    }
    return res;
  };

  const logout = async () => {
    await authApi.logout();
    setUser(null);
    setToken(null);
    setUnreadCount(0);
  };

  const refreshProfile = async () => {
    try {
      const res = await authApi.getProfile();
      if (res.user) setUser(res.user);
    } catch (e) {}
  };

  const refreshNotifications = async () => {
    try {
      const res = await notificationsApi.getNotifications();
      if (res.success && res.unreadCount !== undefined) {
        setUnreadCount(res.unreadCount);
      }
    } catch (e) {}
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        unreadCount,
        login,
        register,
        verifyEmail,
        resendVerification,
        updateProfile,
        logout,
        refreshProfile,
        refreshNotifications,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
