import React, { createContext, useContext, useState, useEffect } from "react";
import { authAPI } from "../services/api";
import toast from "react-hot-toast";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (token) {
      authAPI.getProfile()
        .then((res) => setUser(res.data.user))
        .catch(() => {
          localStorage.removeItem("access_token");
          localStorage.removeItem("refresh_token");
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const res = await authAPI.login({ email, password });
    localStorage.setItem("access_token", res.data.access_token);
    localStorage.setItem("refresh_token", res.data.refresh_token);
    setUser(res.data.user);
    return res.data.user;
  };

  const register = async (username, email, password) => {
    const res = await authAPI.register({ username, email, password });
    localStorage.setItem("access_token", res.data.access_token);
    localStorage.setItem("refresh_token", res.data.refresh_token);
    setUser(res.data.user);
    return res.data.user;
  };

  const logout = async () => {
    try { await authAPI.logout(); } catch {}
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
