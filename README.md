# 👁 Drishyamitra — AI Photo Management System

> A full-stack AI-powered photo companion using DeepFace, Groq LLM, React & Flask

---

## 🏗 Architecture

```
drishyamitra/
├── backend/                    # Flask API
│   ├── app.py                  # App factory & entry point
│   ├── config.py               # Configuration (env vars)
│   ├── extensions.py           # SQLAlchemy instance
│   ├── models.py               # DB models (User, Photo, Person, Chat, Share)
│   ├── requirements.txt
│   ├── .env.example
│   ├── routes/
│   │   ├── auth.py             # JWT auth (register/login/profile)
│   │   ├── photos.py           # Upload, CRUD, face processing, serve files
│   │   ├── persons.py          # People management
│   │   ├── chat.py             # Groq NLP chatbot
│   │   └── share.py            # Email & WhatsApp sharing
│   └── services/
│       └── face_service.py     # DeepFace pipeline (detect/embed/match)
│
└── frontend/                   # React SPA
    ├── public/index.html
    ├── package.json
    └── src/
        ├── App.js              # Router + providers
        ├── index.css           # Global dark theme
        ├── index.js
        ├── context/
        │   └── AuthContext.js  # JWT auth state
        ├── services/
        │   └── api.js          # Axios instance + all API calls
        ├── components/
        │   └── Layout.js       # Sidebar + shell
        └── pages/
            ├── Login.js
            ├── Register.js
            ├── Dashboard.js    # Stats + recent photos + quick actions
            ├── Gallery.js      # Photo grid + lightbox + face assignment
            ├── People.js       # People directory
            ├── PersonDetail.js # Person's photos + share
            ├── Upload.js       # Drag & drop uploader
            ├── Chat.js         # AI conversational interface
            └── ShareHistory.js # Share logs
```

---

## ⚙️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, React Router v6, Axios |
| Backend | Flask 3, Flask-JWT-Extended, SQLAlchemy |
| Database | SQLite (dev) / PostgreSQL (prod) |
| Face Recognition | DeepFace (Facenet512 + RetinaFace + MTCNN) |
| NLP / LLM | Groq (Llama3-70B) |
| Email | SMTP (Gmail / any provider) |
| WhatsApp | Twilio WhatsApp API |
| Styling | Custom CSS (Catppuccin dark theme) |

---

## 🚀 Setup

### Prerequisites
- Python 3.10+
- Node.js 18+
- (Optional) PostgreSQL for production

---

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your API keys

# Run development server
python app.py
# → Runs on http://localhost:5000
```

---

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm start
# → Runs on http://localhost:3000
```

---

## 🔑 Environment Variables

| Variable | Description |
|----------|-------------|
| `SECRET_KEY` | Flask secret key |
| `JWT_SECRET_KEY` | JWT signing key |
| `DATABASE_URL` | SQLite or PostgreSQL URL |
| `GROQ_API_KEY` | Get from [console.groq.com](https://console.groq.com) |
| `MAIL_USERNAME` | SMTP email |
| `MAIL_PASSWORD` | App password (for Gmail: 2FA + App Password) |
| `TWILIO_ACCOUNT_SID` | From Twilio console |
| `TWILIO_AUTH_TOKEN` | From Twilio console |

---

## 📱 Features

### ✅ Core Features
- **AI Face Detection** — DeepFace auto-detects faces in every uploaded photo
- **Face Recognition** — Matches faces to known people (Facenet512, cosine similarity)
- **Face Labeling** — Click any face in a photo to assign a person name
- **Smart Gallery** — Filter by person, search by caption/tag
- **Person Profiles** — View all photos of a specific person
- **Drag & Drop Upload** — Multi-file uploader with progress tracking

### 💬 AI Assistant
- Natural language queries ("Show me photos of John from last month")
- Action execution (search, filter, stats)
- Persistent chat sessions with history

### 📤 Sharing
- Send photos via **Email** (SMTP)
- Send via **WhatsApp** (Twilio)
- Share all photos of a specific person at once
- Share history tracking

### 🔐 Security
- JWT access + refresh tokens
- Password hashing (Werkzeug)
- Per-user data isolation
- File access requires authentication

---

## 🧠 Face Recognition Pipeline

```
Upload Photo
    ↓
RetinaFace Detection      (finds face bounding boxes)
    ↓
Face Crop + Alignment
    ↓
Facenet512 Embedding      (512-dim vector per face)
    ↓
Cosine Similarity Search  (compare against known persons)
    ↓
Auto-label OR flag unknown
```

Threshold: `0.6` cosine similarity (configurable in `config.py`)

---

## 🌐 API Reference

```
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/me

POST /api/photos/upload          # multipart/form-data, field: "photos"
GET  /api/photos/                # ?page, per_page, search, person_id
GET  /api/photos/:id
PUT  /api/photos/:id
DELETE /api/photos/:id
POST /api/photos/faces/:id/assign
GET  /api/photos/stats

GET  /api/persons/
POST /api/persons/
GET  /api/persons/:id
PUT  /api/persons/:id
DELETE /api/persons/:id

GET  /api/chat/sessions
POST /api/chat/sessions
GET  /api/chat/sessions/:id/messages
POST /api/chat/sessions/:id/send

POST /api/share/send             # { photo_ids, platform, recipient, message }
GET  /api/share/history
```

---

## 🏭 Production Deployment

1. Set `DEBUG=False` and use PostgreSQL
2. Use **Gunicorn**: `gunicorn -w 4 "app:create_app()"`
3. Use **Nginx** as reverse proxy
4. Move face processing to **Celery + Redis** for async
5. Store uploaded files on **AWS S3** or similar
6. Use proper media URLs for WhatsApp (Twilio needs public URLs)

---

## 📄 License

MIT License — built for educational and personal use.
