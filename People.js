import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { personsAPI } from "../services/api";
import { Plus, X, Search } from "lucide-react";
import toast from "react-hot-toast";

function AddPersonModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ name: "", relation: "", notes: "" });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await personsAPI.create(form);
      toast.success("Person added!");
      onCreated(res.data.person);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to add person");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Add New Person</span>
          <button className="btn-icon" onClick={onClose}><X size={14} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Name *</label>
              <input className="form-input" placeholder="Full name" value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="form-group">
              <label className="form-label">Relation</label>
              <select className="form-input form-select" value={form.relation}
                onChange={e => setForm({ ...form, relation: e.target.value })}>
                <option value="">Select relation...</option>
                <option value="family">Family</option>
                <option value="friend">Friend</option>
                <option value="colleague">Colleague</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea className="form-input form-textarea" placeholder="Any notes..."
                value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-ghost" type="button" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" type="submit" disabled={loading}>
              {loading ? "Adding..." : "Add Person"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function People() {
  const [persons, setPersons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    personsAPI.list().then(res => setPersons(res.data.persons)).finally(() => setLoading(false));
  }, []);

  const filtered = persons.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  const RELATION_COLORS = {
    family: "var(--green)", friend: "var(--blue)",
    colleague: "var(--yellow)", other: "var(--overlay0)"
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">People</h1>
          <p className="page-subtitle">{persons.length} people in your collection</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
          <Plus size={14} /> Add Person
        </button>
      </div>

      <div className="page-body">
        <div className="search-bar" style={{ maxWidth: 360, marginBottom: 24 }}>
          <Search size={14} style={{ color: "var(--overlay0)" }} />
          <input placeholder="Search people..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        {loading ? (
          <div className="grid-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="card pulse" style={{ height: 140 }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">👤</div>
            <div className="empty-state-title">No people found</div>
            <div className="empty-state-text">
              {persons.length === 0
                ? "Upload photos and the AI will detect faces automatically"
                : "Try adjusting your search"
              }
            </div>
            <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setShowAdd(true)}>
              <Plus size={14} /> Add Person Manually
            </button>
          </div>
        ) : (
          <div className="grid-3">
            {filtered.map(person => (
              <Link key={person.id} to={`/people/${person.id}`} className="person-card">
                <div className="person-avatar-lg">
                  {person.representative_face ? (
                    <img src={`/api/photos/face-image/${person.id}`} alt={person.name}
                      onError={e => { e.target.style.display = "none"; e.target.nextSibling.style.display = "flex"; }} />
                  ) : null}
                  <span>{person.name[0]?.toUpperCase()}</span>
                </div>
                <div className="person-name">{person.name}</div>
                <div className="person-meta">
                  {person.photo_count} photo{person.photo_count !== 1 ? "s" : ""}
                  {person.relation && (
                    <span style={{ marginLeft: 8, color: RELATION_COLORS[person.relation] || "var(--overlay0)" }}>
                      • {person.relation}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {showAdd && (
        <AddPersonModal
          onClose={() => setShowAdd(false)}
          onCreated={(p) => setPersons(prev => [...prev, p])}
        />
      )}
    </div>
  );
}
