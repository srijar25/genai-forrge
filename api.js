/**
 * Drishyamitra API Service
 * Centralized axios instance with JWT handling
 */
import axios from "axios";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:5000/api";

const api = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

// Attach JWT to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle token expiry
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refresh = localStorage.getItem("refresh_token");
      if (refresh) {
        try {
          const res = await axios.post(`${API_BASE}/auth/refresh`, {}, {
            headers: { Authorization: `Bearer ${refresh}` },
          });
          const newToken = res.data.access_token;
          localStorage.setItem("access_token", newToken);
          original.headers.Authorization = `Bearer ${newToken}`;
          return api(original);
        } catch {
          localStorage.removeItem("access_token");
          localStorage.removeItem("refresh_token");
          window.location.href = "/login";
        }
      }
    }
    return Promise.reject(error);
  }
);

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authAPI = {
  register: (data) => api.post("/auth/register", data),
  login: (data) => api.post("/auth/login", data),
  logout: () => api.post("/auth/logout"),
  getProfile: () => api.get("/auth/me"),
  updateProfile: (data) => api.put("/auth/me", data),
};

// ── Photos ────────────────────────────────────────────────────────────────────
export const photosAPI = {
  upload: (formData, onProgress) =>
    api.post("/photos/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (e) => onProgress?.(Math.round((e.loaded * 100) / e.total)),
    }),
  list: (params) => api.get("/photos/", { params }),
  get: (id) => api.get(`/photos/${id}`),
  update: (id, data) => api.put(`/photos/${id}`, data),
  delete: (id) => api.delete(`/photos/${id}`),
  stats: () => api.get("/photos/stats"),
  assignFace: (photoId, data) => api.post(`/photos/faces/${photoId}/assign`, data),
  reprocess: (id) => api.post(`/photos/reprocess/${id}`),
  getFileUrl: (filename) => `${API_BASE}/photos/file/${filename}`,
  getThumbnailUrl: (filename) => `${API_BASE}/photos/thumbnail/${filename}`,
  getFaceUrl: (faceId) => `${API_BASE}/photos/face/${faceId}`,
};

// ── Persons ───────────────────────────────────────────────────────────────────
export const personsAPI = {
  list: () => api.get("/persons/"),
  create: (data) => api.post("/persons/", data),
  get: (id) => api.get(`/persons/${id}`),
  update: (id, data) => api.put(`/persons/${id}`, data),
  delete: (id) => api.delete(`/persons/${id}`),
  merge: (data) => api.post("/persons/merge", data),
};

// ── Chat ──────────────────────────────────────────────────────────────────────
export const chatAPI = {
  getSessions: () => api.get("/chat/sessions"),
  createSession: () => api.post("/chat/sessions"),
  getMessages: (sessionId) => api.get(`/chat/sessions/${sessionId}/messages`),
  sendMessage: (sessionId, message) => api.post(`/chat/sessions/${sessionId}/send`, { message }),
  quickQuery: (message) => api.post("/chat/quick-query", { message }),
};

// ── Share ─────────────────────────────────────────────────────────────────────
export const shareAPI = {
  send: (data) => api.post("/share/send", data),
  history: () => api.get("/share/history"),
};

export default api;
