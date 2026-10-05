import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login as loginApi } from '../api/authApi';
import { setLogoutHandler } from '../api/axiosClient';

const AuthContext = createContext(null);

const STORAGE_KEYS = { token: 'token', role: 'role', email: 'email', username: 'username' };

export const AuthProvider = ({ children }) => {
  const navigate = useNavigate();
  const [token, setToken] = useState(() => localStorage.getItem(STORAGE_KEYS.token));
  const [role, setRole] = useState(() => localStorage.getItem(STORAGE_KEYS.role));
  const [email, setEmail] = useState(() => localStorage.getItem(STORAGE_KEYS.email));
  // Absent for sessions that signed in before the login response carried it; the UI
  // falls back to the email for those until the next sign-in.
  const [username, setUsername] = useState(() => localStorage.getItem(STORAGE_KEYS.username));

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEYS.token);
    localStorage.removeItem(STORAGE_KEYS.role);
    localStorage.removeItem(STORAGE_KEYS.email);
    localStorage.removeItem(STORAGE_KEYS.username);
    setToken(null);
    setRole(null);
    setEmail(null);
    setUsername(null);
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
    if (data.username) localStorage.setItem(STORAGE_KEYS.username, data.username);
    else localStorage.removeItem(STORAGE_KEYS.username);
    setToken(data.token);
    setRole(data.role);
    setEmail(data.email);
    setUsername(data.username || null);
    return data;
  };

  const value = useMemo(
    () => ({ token, role, email, username, isAuthenticated: !!token, login, logout }),
    [token, role, email, username, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
