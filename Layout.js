import React, { useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  LayoutDashboard, Images, Users, MessageCircle,
  Upload, Share2, LogOut, ChevronDown
} from "lucide-react";
import toast from "react-hot-toast";

const NAV = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/gallery", icon: Images, label: "Gallery" },
  { to: "/people", icon: Users, label: "People" },
  { to: "/chat", icon: MessageCircle, label: "AI Assistant" },
  { to: "/upload", icon: Upload, label: "Upload" },
  { to: "/share-history", icon: Share2, label: "Share History" },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    toast.success("Logged out");
    navigate("/login");
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-name">👁 Drishyamitra</div>
          <div className="logo-tagline">AI Photo Companion</div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section-title">Navigation</div>
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to} to={to}
              className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-chip" onClick={handleLogout} title="Logout">
            <div className="user-avatar">
              {user?.username?.[0]?.toUpperCase() || "U"}
            </div>
            <div className="user-info" style={{ flex: 1 }}>
              <div className="user-name">{user?.username}</div>
              <div className="user-email">{user?.email}</div>
            </div>
            <LogOut size={14} style={{ color: "var(--overlay0)" }} />
          </div>
        </div>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
