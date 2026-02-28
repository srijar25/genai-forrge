import React, { useEffect, useState, useCallback } from "react";
import { photosAPI, personsAPI } from "../services/api";
import { Search, X, ScanFace, Send, Trash2, Tag, ZoomIn } from "lucide-react";
import toast from "react-hot-toast";

function Lightbox({ photo, onClose, onFaceAssign, persons }) {
  const [showAssign, setShowAssign] = useState(null); // face object
  const [personName, setPersonName] = useState("");
  const [selectedPerson, setSelectedPerson] = useState("");

  const handleAssign = async () => {
    if (!showAssign) return;
    try {
      await photosAPI.assignFace(photo.id, {
        face_id: showAssign.id,
        person_id: selectedPerson ? parseInt(selectedPerson) : undefined,
        new_person_name: !selectedPerson ? personName : undefined,
      });
      toast.success("Face assigned!");
      setShowAssign(null);
      onFaceAssign();
    } catch {
      toast.error("Failed to assign face");
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Delete this photo?")) return;
    try {
      await photosAPI.delete(photo.id);
      toast.success("Photo deleted");
      onClose();
    } catch {
      toast.error("Delete failed");
    }
  };

  return (
    <div className="lightbox" onClick={onClose}>
      <button className="lightbox-close" onClick={onClose}><X size={16} /></button>

      <img
        src={photo.filepath}
        alt={photo.original_filename}
        onClick={e => e.stopPropagation()}
        onError={e => { e.target.src = `https://via.placeholder.com/600x400/313244/cdd6f4?text=Photo`; }}
      />

      <div className="lightbox-info" onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>{photo.original_filename}</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
              {photo.uploaded_at && new Date(photo.uploaded_at).toLocaleDateString()}
              {photo.width && ` • ${photo.width}×${photo.height}`}
            </div>
            {/* Face Badges */}
            {photo.faces?.length > 0 && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                {photo.faces.map(face => (
                  <button
                    key={face.id}
                    className="face-badge"
                    onClick={() => setShowAssign(face)}
                    style={{ cursor: "pointer", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", color: "white" }}
                  >
                    <div className="face-avatar">{face.person_name?.[0] || "?"}</div>
                    {face.person_name || "Unknown"}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={handleDelete} style={{ color: "var(--red)" }}>
              <Trash2 size={12} /> Delete
            </button>
          </div>
        </div>
      </div>

      {/* Face Assignment Modal */}
      {showAssign && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3000 }}
          onClick={() => setShowAssign(null)}>
          <div className="modal" style={{ maxWidth: 380 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Who is this?</span>
              <button className="btn-icon" onClick={() => setShowAssign(null)}><X size={14} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Select existing person</label>
                <select className="form-input form-select" value={selectedPerson} onChange={e => setSelectedPerson(e.target.value)}>
                  <option value="">-- New person --</option>
                  {persons.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              {!selectedPerson && (
                <div className="form-group">
                  <label className="form-label">Or enter new name</label>
                  <input className="form-input" placeholder="Person name..." value={personName} onChange={e => setPersonName(e.target.value)} />
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowAssign(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAssign} disabled={!selectedPerson && !personName}>Assign</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Gallery() {
  const [photos, setPhotos] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [personFilter, setPersonFilter] = useState("");
  const [persons, setPersons] = useState([]);
  const [selected, setSelected] = useState(null);

  const fetchPhotos = useCallback(async (reset = false) => {
    setLoading(true);
    try {
      const p = reset ? 1 : page;
      const res = await photosAPI.list({
        page: p, per_page: 24,
        search,
        person_id: personFilter || undefined,
      });
      if (reset || p === 1) {
        setPhotos(res.data.photos);
      } else {
        setPhotos(prev => [...prev, ...res.data.photos]);
      }
      setTotal(res.data.total);
      setPage(p + 1);
    } finally {
      setLoading(false);
    }
  }, [search, personFilter, page]);

  useEffect(() => {
    personsAPI.list().then(r => setPersons(r.data.persons));
  }, []);

  useEffect(() => {
    setPage(1);
    fetchPhotos(true);
  }, [search, personFilter]);

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Gallery</h1>
          <p className="page-subtitle">{total} photos in your collection</p>
        </div>
      </div>

      <div className="page-body">
        {/* Filters */}
        <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
          <div className="search-bar" style={{ flex: 1, minWidth: 200 }}>
            <Search size={14} style={{ color: "var(--overlay0)" }} />
            <input
              placeholder="Search photos..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && <button className="btn-icon" style={{ padding: 2 }} onClick={() => setSearch("")}><X size={12} /></button>}
          </div>

          <div className="filter-chips">
            <button className={`chip ${!personFilter ? "active" : ""}`} onClick={() => setPersonFilter("")}>
              All
            </button>
            {persons.map(p => (
              <button
                key={p.id}
                className={`chip ${personFilter === String(p.id) ? "active" : ""}`}
                onClick={() => setPersonFilter(personFilter === String(p.id) ? "" : String(p.id))}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>

        {/* Photo Grid */}
        {photos.length === 0 && !loading ? (
          <div className="empty-state">
            <div className="empty-state-icon">🖼</div>
            <div className="empty-state-title">No photos found</div>
            <div className="empty-state-text">Try adjusting your filters or upload some photos</div>
          </div>
        ) : (
          <div className="photo-grid">
            {photos.map(photo => (
              <div
                key={photo.id}
                className="photo-card"
                onClick={() => setSelected(photo)}
              >
                <img
                  src={photo.thumbnail}
                  alt={photo.original_filename}
                  loading="lazy"
                  onError={e => { e.target.src = `https://via.placeholder.com/200x200/313244/cdd6f4?text=📷`; }}
                />
                <div className="photo-card-overlay">
                  <div className="photo-card-actions">
                    <button className="btn-icon" style={{ width: 28, height: 28, padding: 0 }}><ZoomIn size={12} /></button>
                    {photo.face_count > 0 && (
                      <span style={{ fontSize: 10, color: "white", display: "flex", alignItems: "center", gap: 3 }}>
                        <ScanFace size={12} /> {photo.face_count}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Load More */}
        {photos.length < total && (
          <div style={{ textAlign: "center", marginTop: 24 }}>
            <button className="btn btn-secondary" onClick={() => fetchPhotos()} disabled={loading}>
              {loading ? "Loading..." : `Load more (${total - photos.length} remaining)`}
            </button>
          </div>
        )}
      </div>

      {/* Lightbox */}
      {selected && (
        <Lightbox
          photo={selected}
          onClose={() => setSelected(null)}
          onFaceAssign={() => {
            setSelected(null);
            fetchPhotos(true);
          }}
          persons={persons}
        />
      )}
    </div>
  );
}
