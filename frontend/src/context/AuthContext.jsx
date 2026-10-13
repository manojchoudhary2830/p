import React, { createContext, useContext, useState, useEffect } from 'react';
import { api, setAuthToken, getAuthToken } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(getAuthToken());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      const currentToken = getAuthToken();
      if (!currentToken) {
        setLoading(false);
        return;
      }
      try {
        const userData = await api.getMe();
        setUser(userData);
      } catch (err) {
        console.error('Failed to load user:', err);
        setAuthToken(null);
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    }
    loadUser();
  }, []);

  const login = async (email, password) => {
    const res = await api.login({ email, password });
    setAuthToken(res.access_token);
    setToken(res.access_token);
    setUser(res.user);
    return res.user;
  };

  const register = async (data) => {
    const res = await api.register(data);
    setAuthToken(res.access_token);
    setToken(res.access_token);
    setUser(res.user);
    return res.user;
  };

  const logout = () => {
    setAuthToken(null);
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        register,
        logout,
        isLoggedIn: !!user,
        isOwner: user?.role === 'owner',
        isTenant: user?.role === 'tenant',
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
