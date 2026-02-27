"""
Drishyamitra - Database Models
"""
from datetime import datetime
from extensions import db
from werkzeug.security import generate_password_hash, check_password_hash


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_active = db.Column(db.Boolean, default=True)
    profile_pic = db.Column(db.String(255), nullable=True)

    # Relationships
    photos = db.relationship("Photo", back_populates="owner", cascade="all, delete-orphan")
    persons = db.relationship("Person", back_populates="owner", cascade="all, delete-orphan")
    chat_sessions = db.relationship("ChatSession", back_populates="user", cascade="all, delete-orphan")
    share_logs = db.relationship("ShareLog", back_populates="user", cascade="all, delete-orphan")

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "created_at": self.created_at.isoformat(),
            "profile_pic": self.profile_pic,
        }


class Person(db.Model):
    __tablename__ = "persons"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    relation = db.Column(db.String(50), nullable=True)  # friend, family, colleague
    notes = db.Column(db.Text, nullable=True)
    representative_face = db.Column(db.String(255), nullable=True)  # path to face image
    face_embedding = db.Column(db.Text, nullable=True)  # JSON encoded embedding
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)

    # Relationships
    owner = db.relationship("User", back_populates="persons")
    photo_faces = db.relationship("PhotoFace", back_populates="person")

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "relation": self.relation,
            "notes": self.notes,
            "representative_face": self.representative_face,
            "created_at": self.created_at.isoformat(),
            "photo_count": len(self.photo_faces),
        }


class Photo(db.Model):
    __tablename__ = "photos"

    id = db.Column(db.Integer, primary_key=True)
    filename = db.Column(db.String(255), nullable=False)
    original_filename = db.Column(db.String(255), nullable=False)
    filepath = db.Column(db.String(500), nullable=False)
    thumbnail_path = db.Column(db.String(500), nullable=True)
    file_size = db.Column(db.Integer, nullable=True)
    mime_type = db.Column(db.String(50), nullable=True)
    width = db.Column(db.Integer, nullable=True)
    height = db.Column(db.Integer, nullable=True)

    # Metadata
    taken_at = db.Column(db.DateTime, nullable=True)  # EXIF date
    location = db.Column(db.String(255), nullable=True)
    tags = db.Column(db.Text, nullable=True)  # JSON array of tags
    caption = db.Column(db.Text, nullable=True)

    # Processing status
    face_processed = db.Column(db.Boolean, default=False)
    face_count = db.Column(db.Integer, default=0)

    uploaded_at = db.Column(db.DateTime, default=datetime.utcnow)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)

    # Relationships
    owner = db.relationship("User", back_populates="photos")
    faces = db.relationship("PhotoFace", back_populates="photo", cascade="all, delete-orphan")
    share_logs = db.relationship("ShareLog", back_populates="photo")

    def to_dict(self):
        import json
        return {
            "id": self.id,
            "filename": self.filename,
            "original_filename": self.original_filename,
            "filepath": f"/api/photos/file/{self.filename}",
            "thumbnail": f"/api/photos/thumbnail/{self.filename}" if self.thumbnail_path else f"/api/photos/file/{self.filename}",
            "file_size": self.file_size,
            "width": self.width,
            "height": self.height,
            "taken_at": self.taken_at.isoformat() if self.taken_at else None,
            "uploaded_at": self.uploaded_at.isoformat(),
            "location": self.location,
            "tags": json.loads(self.tags) if self.tags else [],
            "caption": self.caption,
            "face_processed": self.face_processed,
            "face_count": self.face_count,
            "faces": [f.to_dict() for f in self.faces],
        }


class PhotoFace(db.Model):
    """Junction between a photo and a recognized person"""
    __tablename__ = "photo_faces"

    id = db.Column(db.Integer, primary_key=True)
    photo_id = db.Column(db.Integer, db.ForeignKey("photos.id"), nullable=False)
    person_id = db.Column(db.Integer, db.ForeignKey("persons.id"), nullable=True)  # Null = unknown

    # Bounding box
    bbox_x = db.Column(db.Float, nullable=True)
    bbox_y = db.Column(db.Float, nullable=True)
    bbox_w = db.Column(db.Float, nullable=True)
    bbox_h = db.Column(db.Float, nullable=True)

    confidence = db.Column(db.Float, nullable=True)
    face_image_path = db.Column(db.String(500), nullable=True)
    embedding = db.Column(db.Text, nullable=True)  # JSON encoded

    photo = db.relationship("Photo", back_populates="faces")
    person = db.relationship("Person", back_populates="photo_faces")

    def to_dict(self):
        return {
            "id": self.id,
            "person_id": self.person_id,
            "person_name": self.person.name if self.person else None,
            "confidence": self.confidence,
            "bbox": {
                "x": self.bbox_x,
                "y": self.bbox_y,
                "w": self.bbox_w,
                "h": self.bbox_h,
            },
            "face_image": f"/api/photos/face/{self.id}" if self.face_image_path else None,
        }


class ChatSession(db.Model):
    __tablename__ = "chat_sessions"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    title = db.Column(db.String(200), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = db.relationship("User", back_populates="chat_sessions")
    messages = db.relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan")


class ChatMessage(db.Model):
    __tablename__ = "chat_messages"

    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.Integer, db.ForeignKey("chat_sessions.id"), nullable=False)
    role = db.Column(db.String(20), nullable=False)  # user / assistant
    content = db.Column(db.Text, nullable=False)
    action_type = db.Column(db.String(50), nullable=True)  # search / share / organize
    action_data = db.Column(db.Text, nullable=True)  # JSON
    photo_results = db.Column(db.Text, nullable=True)  # JSON array of photo IDs
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    session = db.relationship("ChatSession", back_populates="messages")

    def to_dict(self):
        import json
        return {
            "id": self.id,
            "role": self.role,
            "content": self.content,
            "action_type": self.action_type,
            "action_data": json.loads(self.action_data) if self.action_data else None,
            "photo_results": json.loads(self.photo_results) if self.photo_results else None,
            "created_at": self.created_at.isoformat(),
        }


class ShareLog(db.Model):
    __tablename__ = "share_logs"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    photo_id = db.Column(db.Integer, db.ForeignKey("photos.id"), nullable=True)
    platform = db.Column(db.String(30), nullable=False)  # email / whatsapp
    recipient = db.Column(db.String(255), nullable=False)
    status = db.Column(db.String(20), default="pending")  # pending / sent / failed
    message = db.Column(db.Text, nullable=True)
    shared_at = db.Column(db.DateTime, default=datetime.utcnow)
    batch_id = db.Column(db.String(50), nullable=True)  # Group batch shares

    user = db.relationship("User", back_populates="share_logs")
    photo = db.relationship("Photo", back_populates="share_logs")

    def to_dict(self):
        return {
            "id": self.id,
            "photo_id": self.photo_id,
            "platform": self.platform,
            "recipient": self.recipient,
            "status": self.status,
            "shared_at": self.shared_at.isoformat(),
        }
