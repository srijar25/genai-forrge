import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { photosAPI, personsAPI } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { Images, Users, ScanFace, Tag, Upload, MessageCircle, ArrowRight } from "lucide-react";

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [recentPhotos, setRecentPhotos] = useState([]);
  const [persons, setPersons] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      photosAPI.stats(),
      photosAPI.list({ per_page: 6 }),
      personsAPI.list(),
    ]).then(([statsRes, photosRes, personsRes]) => {
      setStats(statsRes.data);
      setRecentPhotos(photosRes.data.photos);
      setPersons(personsRes.data.persons.slice(0, 5));
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const STAT_CARDS = stats ? [
    { label: "Total Photos", value: stats.total_photos, icon: Images, color: "var(--blue)", bg: "rgba(137,180,250,0.1)" },
    { label: "People Identified", value: stats.persons_count, icon: Users, color: "var(--mauve)", bg: "rgba(203,166,247,0.1)" },
    { label: "Faces Tagged", value: stats.faces_tagged, icon: ScanFace, color: "var(--teal)", bg: "rgba(148,226,213,0.1)" },
    { label: "Unidentified", value: stats.faces_unknown, icon: Tag, color: "var(--yellow)", bg: "rgba(249,226,175,0.1)" },
  ] : [];

  const QUICK_ACTIONS = [
    { to: "/upload", icon: Upload, label: "Upload Photos", desc: "Add new photos to your collection" },
    { to: "/chat", icon: MessageCircle, label: "Ask AI Assistant", desc: "Search & share with natural language" },
    { to: "/people", icon: Users, label: "Manage People", desc: "View & organize by person" },
  ];

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Welcome back, {user?.username} 👋</h1>
          <p className="page-subtitle">Your AI photo companion is ready</p>
        </div>
        <Link to="/upload" className="btn btn-primary">
          <Upload size={14} /> Upload Photos
        </Link>
      </div>

      <div className="page-body">
        {/* Stats */}
        {loading ? (
          <div className="grid-4" style={{ marginBottom: 28 }}>
            {[...Array(4)].map((_, i) => (
              <div key={i} className="stat-card pulse" style={{ height: 88 }} />
            ))}
          </div>
        ) : (
          <div className="grid-4" style={{ marginBottom: 28 }}>
            {STAT_CARDS.map(({ label, value, icon: Icon, color, bg }) => (
              <div key={label} className="stat-card">
                <div className="stat-icon" style={{ background: bg }}>
                  <Icon size={20} style={{ color }} />
                </div>
                <div>
                  <div className="stat-value">{value}</div>
                  <div className="stat-label">{label}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 24 }}>
          {/* Recent Photos */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700 }}>Recent Photos</h2>
              <Link to="/gallery" className="btn btn-ghost btn-sm">
                View all <ArrowRight size={12} />
              </Link>
            </div>
            {recentPhotos.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">📷</div>
                <div className="empty-state-title">No photos yet</div>
                <div className="empty-state-text">Upload your first photos to get started</div>
                <Link to="/upload" className="btn btn-primary" style={{ marginTop: 16 }}>Upload Now</Link>
              </div>
            ) : (
              <div className="photo-grid">
                {recentPhotos.map(photo => (
                  <Link key={photo.id} to="/gallery" className="photo-card">
                    <img
                      src={photo.thumbnail}
                      alt={photo.original_filename}
                      onError={e => { e.target.src = `https://via.placeholder.com/180x180/313244/cdd6f4?text=📷`; }}
                    />
                    <div className="photo-card-overlay">
                      <span style={{ fontSize: 11, color: "white" }}>
                        {photo.face_count > 0 ? `${photo.face_count} face${photo.face_count > 1 ? "s" : ""}` : ""}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Right Panel */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Quick Actions */}
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Quick Actions</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {QUICK_ACTIONS.map(({ to, icon: Icon, label, desc }) => (
                  <Link key={to} to={to} className="card" style={{ display: "flex", gap: 12, alignItems: "center", textDecoration: "none" }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: "var(--surface0)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Icon size={16} style={{ color: "var(--accent)" }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{label}</div>
                      <div style={{ fontSize: 11, color: "var(--overlay0)" }}>{desc}</div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* People */}
            {persons.length > 0 && (
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <h2 style={{ fontSize: 16, fontWeight: 700 }}>People</h2>
                  <Link to="/people" className="btn btn-ghost btn-sm">All <ArrowRight size={12} /></Link>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {persons.map(person => (
                    <Link
                      key={person.id} to={`/people/${person.id}`}
                      style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 8, background: "var(--surface0)", textDecoration: "none", transition: "background 0.2s" }}
                    >
                      <div className="user-avatar" style={{ width: 28, height: 28, fontSize: 12 }}>
                        {person.name[0].toUpperCase()}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{person.name}</div>
                        <div style={{ fontSize: 11, color: "var(--overlay0)" }}>{person.photo_count} photos</div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
