import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { personsAPI, shareAPI } from "../services/api";
import { ArrowLeft, Mail, MessageSquare, Trash2, Edit2, X, Send } from "lucide-react";
import toast from "react-hot-toast";

function ShareModal({ person, onClose }) {
  const [platform, setPlatform] = useState("email");
  const [recipient, setRecipient] = useState("");
  const [message, setMessage] = useState(`Here are some photos of ${person.name}!`);
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!recipient) return toast.error("Recipient required");
    setLoading(true);
    try {
      const res = await shareAPI.send({
        person_id: person.id,
        platform,
        recipient,
        message,
      });
      toast.success(res.data.message);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || "Share failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Share {person.name}'s Photos</span>
          <button className="btn-icon" onClick={onClose}><X size={14} /></button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Platform</label>
            <div className="filter-chips">
              <button className={`chip ${platform === "email" ? "active" : ""}`} onClick={() => setPlatform("email")}>
                <Mail size={12} /> Email
              </button>
              <button className={`chip ${platform === "whatsapp" ? "active" : ""}`} onClick={() => setPlatform("whatsapp")}>
                <MessageSquare size={12} /> WhatsApp
              </button>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">{platform === "email" ? "Email address" : "Phone number (+91...)"}</label>
            <input
              className="form-input"
              placeholder={platform === "email" ? "recipient@example.com" : "+919876543210"}
              value={recipient}
              onChange={e => setRecipient(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Message</label>
            <textarea
              className="form-input form-textarea"
              value={message}
              onChange={e => setMessage(e.target.value)}
            />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSend} disabled={loading}>
            <Send size={12} /> {loading ? "Sending..." : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PersonDetail() {
  const { personId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [showShare, setShowShare] = useState(false);

  useEffect(() => {
    personsAPI.get(personId)
      .then(res => {
        setData(res.data);
        setEditForm({ name: res.data.person.name, relation: res.data.person.relation || "", notes: res.data.person.notes || "" });
      })
      .finally(() => setLoading(false));
  }, [personId]);

  const handleDelete = async () => {
    if (!window.confirm(`Delete ${data.person.name}? Their photos will remain.`)) return;
    try {
      await personsAPI.delete(personId);
      toast.success("Person deleted");
      navigate("/people");
    } catch {
      toast.error("Failed to delete");
    }
  };

  const handleSaveEdit = async () => {
    try {
      const res = await personsAPI.update(personId, editForm);
      setData(prev => ({ ...prev, person: res.data.person }));
      setEditing(false);
      toast.success("Updated!");
    } catch {
      toast.error("Update failed");
    }
  };

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>;
  if (!data) return <div className="page-body">Person not found</div>;

  const { person, photos } = data;

  return (
    <div className="fade-in">
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link to="/people" className="btn-icon"><ArrowLeft size={16} /></Link>
          <div>
            <h1 className="page-title">{person.name}</h1>
            <p className="page-subtitle">{person.photo_count} photos {person.relation && `• ${person.relation}`}</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-ghost" onClick={() => setEditing(true)}><Edit2 size={13} /> Edit</button>
          <button className="btn btn-secondary" onClick={() => setShowShare(true)}><Send size={13} /> Share</button>
          <button className="btn btn-danger" onClick={handleDelete}><Trash2 size={13} /></button>
        </div>
      </div>

      <div className="page-body">
        {/* Edit Panel */}
        {editing && (
          <div className="card" style={{ marginBottom: 24 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 12, alignItems: "end" }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Name</label>
                <input className="form-input" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Relation</label>
                <select className="form-input form-select" value={editForm.relation} onChange={e => setEditForm({ ...editForm, relation: e.target.value })}>
                  <option value="">None</option>
                  <option value="family">Family</option>
                  <option value="friend">Friend</option>
                  <option value="colleague">Colleague</option>
                </select>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Notes</label>
                <input className="form-input" value={editForm.notes} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} />
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button className="btn btn-primary btn-sm" onClick={handleSaveEdit}>Save</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* Photos */}
        {photos.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📷</div>
            <div className="empty-state-title">No photos yet</div>
            <div className="empty-state-text">Upload photos and assign faces to see them here</div>
          </div>
        ) : (
          <>
            <p style={{ color: "var(--overlay0)", fontSize: 13, marginBottom: 16 }}>Showing {photos.length} photos</p>
            <div className="photo-grid">
              {photos.map(photo => (
                <div key={photo.id} className="photo-card">
                  <img
                    src={photo.thumbnail}
                    alt={photo.original_filename}
                    loading="lazy"
                    onError={e => { e.target.src = `https://via.placeholder.com/180x180/313244/cdd6f4?text=📷`; }}
                  />
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {showShare && <ShareModal person={person} onClose={() => setShowShare(false)} />}
    </div>
  );
}
