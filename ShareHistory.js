import React, { useEffect, useState } from "react";
import { shareAPI } from "../services/api";
import { Mail, MessageSquare, CheckCircle, XCircle, Clock } from "lucide-react";
import { format } from "date-fns";

export default function ShareHistory() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    shareAPI.history()
      .then(res => setHistory(res.data.history))
      .finally(() => setLoading(false));
  }, []);

  const STATUS_CONFIG = {
    sent: { icon: CheckCircle, label: "Sent", className: "badge-success" },
    failed: { icon: XCircle, label: "Failed", className: "badge-error" },
    pending: { icon: Clock, label: "Pending", className: "badge-warning" },
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Share History</h1>
          <p className="page-subtitle">Track all your photo shares</p>
        </div>
      </div>

      <div className="page-body">
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[...Array(5)].map((_, i) => (
              <div key={i} className="card pulse" style={{ height: 60 }} />
            ))}
          </div>
        ) : history.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📤</div>
            <div className="empty-state-title">No shares yet</div>
            <div className="empty-state-text">Share photos from the People section or Gallery</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {history.map(log => {
              const cfg = STATUS_CONFIG[log.status] || STATUS_CONFIG.pending;
              const StatusIcon = cfg.icon;
              return (
                <div key={log.id} className="card" style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px" }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 8,
                    background: log.platform === "email" ? "rgba(137,180,250,0.1)" : "rgba(166,227,161,0.1)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {log.platform === "email"
                      ? <Mail size={16} style={{ color: "var(--blue)" }} />
                      : <MessageSquare size={16} style={{ color: "var(--green)" }} />
                    }
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
                      {log.platform === "email" ? "Email" : "WhatsApp"} → {log.recipient}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--overlay0)", marginTop: 2 }}>
                      {log.shared_at ? format(new Date(log.shared_at), "MMM d, yyyy 'at' h:mm a") : ""}
                      {log.photo_id && ` • Photo #${log.photo_id}`}
                    </div>
                  </div>
                  <span className={`badge ${cfg.className}`}>
                    <StatusIcon size={11} />
                    {cfg.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
