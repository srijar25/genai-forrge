import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(form.email, form.password);
      toast.success("Welcome back!");
      navigate("/dashboard");
    } catch (err) {
      toast.error(err.response?.data?.error || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card fade-in">
        <div className="auth-logo">👁 Drishyamitra</div>
        <div className="auth-subtitle">Your AI-powered photo companion</div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              className="form-input"
              type="email" placeholder="you@example.com"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              className="form-input"
              type="password" placeholder="••••••••"
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              required
            />
          </div>

          <button
            className="btn btn-primary" type="submit"
            disabled={loading}
            style={{ width: "100%", justifyContent: "center", marginTop: 8 }}
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div className="auth-divider"><span>or</span></div>
        <p style={{ textAlign: "center", fontSize: 13, color: "var(--overlay0)" }}>
          New here?{" "}
          <Link to="/register" style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 600 }}>
            Create account
          </Link>
        </p>
      </div>
    </div>
  );
}
