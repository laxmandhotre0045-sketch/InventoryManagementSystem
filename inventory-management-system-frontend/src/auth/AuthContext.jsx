import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login as loginApi } from '../api/authApi';
import { setLogoutHandler } from '../api/axiosClient';

const AuthContext = createContext(null);

const STORAGE_KEYS = { token: 'token', role: 'role', email: 'email' };

export const AuthProvider = ({ children }) => {
  const navigate = useNavigate();
  const [token, setToken] = useState(() => localStorage.getItem(STORAGE_KEYS.token));
  const [role, setRole] = useState(() => localStorage.getItem(STORAGE_KEYS.role));
  const [email, setEmail] = useState(() => localStorage.getItem(STORAGE_KEYS.email));

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEYS.token);
    localStorage.removeItem(STORAGE_KEYS.role);
    localStorage.removeItem(STORAGE_KEYS.email);
    setToken(null);
    setRole(null);
    setEmail(null);
    navigate('/login', { replace: true });
  }, [navigate]);

  useEffect(() => {
    setLogoutHandler(logout);
  }, [logout]);

  const login = async (emailInput, password) => {
    const data = await loginApi(emailInput, password);
    localStorage.setItem(STORAGE_KEYS.token, data.token);
    localStorage.setItem(STORAGE_KEYS.role, data.role);
    localStorage.setItem(STORAGE_KEYS.email, data.email);
    setToken(data.token);
    setRole(data.role);
    setEmail(data.email);
    return data;
  };

  const value = useMemo(
    () => ({ token, role, email, isAuthenticated: !!token, login, logout }),
    [token, role, email, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
