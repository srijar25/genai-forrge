import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: "", email: "", password: "", confirm: "" });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirm) {
      return toast.error("Passwords don't match");
    }
    setLoading(true);
    try {
      await register(form.username, form.email, form.password);
      toast.success("Account created!");
      navigate("/dashboard");
    } catch (err) {
      toast.error(err.response?.data?.error || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const f = (field) => ({
    value: form[field],
    onChange: (e) => setForm({ ...form, [field]: e.target.value }),
  });

  return (
    <div className="auth-page">
      <div className="auth-card fade-in">
        <div className="auth-logo">👁 Drishyamitra</div>
        <div className="auth-subtitle">Create your photo companion account</div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Username</label>
            <input className="form-input" placeholder="johndoe" {...f("username")} required />
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-input" type="email" placeholder="you@example.com" {...f("email")} required />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input className="form-input" type="password" placeholder="••••••••" {...f("password")} required minLength={8} />
          </div>
          <div className="form-group">
            <label className="form-label">Confirm Password</label>
            <input className="form-input" type="password" placeholder="••••••••" {...f("confirm")} required />
          </div>

          <button
            className="btn btn-primary" type="submit" disabled={loading}
            style={{ width: "100%", justifyContent: "center", marginTop: 8 }}
          >
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <div className="auth-divider"><span>or</span></div>
        <p style={{ textAlign: "center", fontSize: 13, color: "var(--overlay0)" }}>
          Already have an account?{" "}
          <Link to="/login" style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 600 }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
