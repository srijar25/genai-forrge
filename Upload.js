import React, { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { photosAPI } from "../services/api";
import { Upload, X, CheckCircle, AlertCircle, CloudUpload } from "lucide-react";
import toast from "react-hot-toast";

function FileItem({ file, status, progress, error }) {
  const icon = status === "done" ? <CheckCircle size={14} style={{ color: "var(--green)" }} />
    : status === "error" ? <AlertCircle size={14} style={{ color: "var(--red)" }} />
    : null;

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "10px 14px", background: "var(--surface0)",
      borderRadius: 8, fontSize: 12,
    }}>
      <img
        src={URL.createObjectURL(file)}
        alt="" style={{ width: 36, height: 36, objectFit: "cover", borderRadius: 4 }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: "var(--text)", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {file.name}
        </div>
        <div style={{ color: "var(--overlay0)", marginTop: 2 }}>
          {(file.size / 1024 / 1024).toFixed(2)} MB
        </div>
        {status === "uploading" && (
          <div className="progress-bar" style={{ marginTop: 4 }}>
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
        )}
        {error && <div style={{ color: "var(--red)", marginTop: 2 }}>{error}</div>}
      </div>
      {icon}
    </div>
  );
}

export default function UploadPage() {
  const [files, setFiles] = useState([]); // { file, status, progress, error }
  const [uploading, setUploading] = useState(false);

  const onDrop = useCallback((accepted) => {
    const newFiles = accepted.map(f => ({ file: f, status: "ready", progress: 0 }));
    setFiles(prev => [...prev, ...newFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [".jpg", ".jpeg", ".png", ".gif", ".webp", ".heic"] },
    maxSize: 50 * 1024 * 1024,
    onDropRejected: (rej) => rej.forEach(r => toast.error(`${r.file.name}: ${r.errors[0]?.message}`)),
  });

  const removeFile = (idx) => setFiles(prev => prev.filter((_, i) => i !== idx));
  const clearAll = () => setFiles([]);

  const uploadAll = async () => {
    const readyFiles = files.filter(f => f.status === "ready");
    if (!readyFiles.length) return toast.error("No files ready to upload");

    setUploading(true);

    // Upload in batches of 5
    const BATCH_SIZE = 5;
    for (let i = 0; i < readyFiles.length; i += BATCH_SIZE) {
      const batch = readyFiles.slice(i, i + BATCH_SIZE);
      const formData = new FormData();
      batch.forEach(({ file }) => formData.append("photos", file));

      // Mark as uploading
      setFiles(prev => prev.map(f =>
        batch.some(b => b.file === f.file) ? { ...f, status: "uploading" } : f
      ));

      try {
        await photosAPI.upload(formData, (progress) => {
          setFiles(prev => prev.map(f =>
            batch.some(b => b.file === f.file) ? { ...f, progress } : f
          ));
        });
        setFiles(prev => prev.map(f =>
          batch.some(b => b.file === f.file) ? { ...f, status: "done", progress: 100 } : f
        ));
      } catch (err) {
        const errMsg = err.response?.data?.error || "Upload failed";
        setFiles(prev => prev.map(f =>
          batch.some(b => b.file === f.file) ? { ...f, status: "error", error: errMsg } : f
        ));
      }
    }

    setUploading(false);
    const done = files.filter(f => f.status === "done").length;
    toast.success(`${done} photo(s) uploaded successfully! AI is processing faces...`);
  };

  const stats = {
    ready: files.filter(f => f.status === "ready").length,
    done: files.filter(f => f.status === "done").length,
    error: files.filter(f => f.status === "error").length,
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Upload Photos</h1>
          <p className="page-subtitle">AI will automatically detect and identify faces</p>
        </div>
      </div>

      <div className="page-body" style={{ maxWidth: 800 }}>
        {/* Drop Zone */}
        <div
          {...getRootProps()}
          className={`upload-zone ${isDragActive ? "active" : ""}`}
          style={{ marginBottom: 24 }}
        >
          <input {...getInputProps()} />
          <CloudUpload size={48} style={{ color: "var(--overlay0)", marginBottom: 16 }} />
          <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text)", marginBottom: 8 }}>
            {isDragActive ? "Drop your photos here!" : "Drag & drop photos here"}
          </div>
          <div style={{ color: "var(--overlay0)", fontSize: 13 }}>
            or click to browse • JPG, PNG, WEBP, GIF, HEIC • Up to 50MB each
          </div>
        </div>

        {/* File Queue */}
        {files.length > 0 && (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ display: "flex", gap: 12, fontSize: 12, color: "var(--overlay0)" }}>
                <span>{files.length} file{files.length !== 1 ? "s" : ""}</span>
                {stats.done > 0 && <span style={{ color: "var(--green)" }}>✓ {stats.done} done</span>}
                {stats.error > 0 && <span style={{ color: "var(--red)" }}>✗ {stats.error} failed</span>}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-ghost btn-sm" onClick={clearAll} disabled={uploading}>
                  <X size={12} /> Clear all
                </button>
                <button
                  className="btn btn-primary"
                  onClick={uploadAll}
                  disabled={uploading || stats.ready === 0}
                >
                  <Upload size={13} />
                  {uploading ? "Uploading..." : `Upload ${stats.ready} photo${stats.ready !== 1 ? "s" : ""}`}
                </button>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {files.map((item, idx) => (
                <div key={idx} style={{ position: "relative" }}>
                  <FileItem {...item} />
                  {item.status === "ready" && (
                    <button
                      className="btn-icon"
                      style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", width: 24, height: 24, padding: 0 }}
                      onClick={() => removeFile(idx)}
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {/* Tips */}
        <div className="card" style={{ marginTop: 32, background: "rgba(203,166,247,0.05)", borderColor: "rgba(203,166,247,0.2)" }}>
          <div className="card-title" style={{ color: "var(--accent)", marginBottom: 12 }}>💡 How it works</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13, color: "var(--subtext0)" }}>
            <div>1. <strong style={{ color: "var(--text)" }}>Upload</strong> – Drop your photos and they'll be added to your gallery</div>
            <div>2. <strong style={{ color: "var(--text)" }}>AI Detection</strong> – DeepFace automatically finds and recognizes faces</div>
            <div>3. <strong style={{ color: "var(--text)" }}>Label</strong> – Open any photo and click a face badge to assign a name</div>
            <div>4. <strong style={{ color: "var(--text)" }}>Search & Share</strong> – Ask the AI assistant to find or share photos by person</div>
          </div>
        </div>
      </div>
    </div>
  );
}
