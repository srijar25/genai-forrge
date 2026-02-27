"""
Photo routes - CRUD + face processing
"""
import os
import uuid
import json
from datetime import datetime
from flask import Blueprint, request, jsonify, send_file, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename
from PIL import Image, ExifTags
from extensions import db
from models import Photo, PhotoFace, Person

photos_bp = Blueprint("photos", __name__)


def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in current_app.config["ALLOWED_EXTENSIONS"]


def extract_exif_date(image_path):
    """Extract date from EXIF data."""
    try:
        img = Image.open(image_path)
        exif_data = img._getexif()
        if exif_data:
            for tag_id, value in exif_data.items():
                tag = ExifTags.TAGS.get(tag_id, tag_id)
                if tag in ("DateTimeOriginal", "DateTime"):
                    return datetime.strptime(value, "%Y:%m:%d %H:%M:%S")
    except Exception:
        pass
    return None


def create_thumbnail(src_path, thumb_path, size=(300, 300)):
    """Create a thumbnail image."""
    try:
        with Image.open(src_path) as img:
            img.thumbnail(size, Image.LANCZOS)
            img.save(thumb_path, "JPEG", quality=85)
        return True
    except Exception:
        return False


@photos_bp.route("/upload", methods=["POST"])
@jwt_required()
def upload_photos():
    user_id = int(get_jwt_identity())

    if "photos" not in request.files:
        return jsonify({"error": "No photos provided"}), 400

    files = request.files.getlist("photos")
    if not files:
        return jsonify({"error": "No files selected"}), 400

    upload_folder = current_app.config["UPLOAD_FOLDER"]
    thumb_folder = current_app.config["THUMBNAIL_FOLDER"]
    os.makedirs(upload_folder, exist_ok=True)
    os.makedirs(thumb_folder, exist_ok=True)

    uploaded = []
    errors = []

    for file in files:
        if not file or not file.filename:
            continue
        if not allowed_file(file.filename):
            errors.append(f"{file.filename}: unsupported type")
            continue

        ext = file.filename.rsplit(".", 1)[1].lower()
        unique_name = f"{uuid.uuid4().hex}.{ext}"
        filepath = os.path.join(upload_folder, unique_name)
        file.save(filepath)

        # Get image dimensions
        width, height = None, None
        try:
            with Image.open(filepath) as img:
                width, height = img.size
        except Exception:
            pass

        # Thumbnail
        thumb_path = os.path.join(thumb_folder, f"thumb_{unique_name}")
        if not create_thumbnail(filepath, thumb_path):
            thumb_path = None

        photo = Photo(
            filename=unique_name,
            original_filename=secure_filename(file.filename),
            filepath=filepath,
            thumbnail_path=thumb_path,
            file_size=os.path.getsize(filepath),
            mime_type=file.mimetype,
            width=width,
            height=height,
            taken_at=extract_exif_date(filepath),
            user_id=user_id,
        )
        db.session.add(photo)
        db.session.flush()  # get photo.id

        # Async face processing (in background in production; inline for demo)
        try:
            _process_faces_inline(photo, user_id, upload_folder)
        except Exception as e:
            current_app.logger.error(f"Face processing failed for {unique_name}: {e}")

        uploaded.append(photo.to_dict())

    db.session.commit()
    return jsonify({
        "uploaded": uploaded,
        "errors": errors,
        "count": len(uploaded),
    }), 201


def _process_faces_inline(photo, user_id, upload_folder):
    """Process faces synchronously (use Celery/RQ in production)."""
    from services.face_service import process_photo_faces

    results = process_photo_faces(photo.filepath, user_id, upload_folder)
    for face_data in results:
        face = PhotoFace(
            photo_id=photo.id,
            person_id=face_data.get("person_id"),
            bbox_x=face_data["bbox"]["x"],
            bbox_y=face_data["bbox"]["y"],
            bbox_w=face_data["bbox"]["w"],
            bbox_h=face_data["bbox"]["h"],
            confidence=face_data.get("confidence"),
            face_image_path=face_data.get("face_image_path"),
            embedding=face_data.get("embedding"),
        )
        db.session.add(face)

    photo.face_processed = True
    photo.face_count = len(results)


@photos_bp.route("/", methods=["GET"])
@jwt_required()
def list_photos():
    user_id = int(get_jwt_identity())

    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 20, type=int)
    person_id = request.args.get("person_id", type=int)
    search = request.args.get("search", "")

    query = Photo.query.filter_by(user_id=user_id)

    if person_id:
        query = query.join(PhotoFace).filter(PhotoFace.person_id == person_id)

    if search:
        query = query.filter(
            db.or_(
                Photo.caption.ilike(f"%{search}%"),
                Photo.tags.ilike(f"%{search}%"),
                Photo.original_filename.ilike(f"%{search}%"),
            )
        )

    pagination = query.order_by(Photo.uploaded_at.desc()).paginate(page=page, per_page=per_page)

    return jsonify({
        "photos": [p.to_dict() for p in pagination.items],
        "total": pagination.total,
        "pages": pagination.pages,
        "current_page": page,
    })


@photos_bp.route("/<int:photo_id>", methods=["GET"])
@jwt_required()
def get_photo(photo_id):
    user_id = int(get_jwt_identity())
    photo = Photo.query.filter_by(id=photo_id, user_id=user_id).first_or_404()
    return jsonify({"photo": photo.to_dict()})


@photos_bp.route("/<int:photo_id>", methods=["PUT"])
@jwt_required()
def update_photo(photo_id):
    user_id = int(get_jwt_identity())
    photo = Photo.query.filter_by(id=photo_id, user_id=user_id).first_or_404()
    data = request.get_json()

    if "caption" in data:
        photo.caption = data["caption"]
    if "tags" in data:
        photo.tags = json.dumps(data["tags"])
    if "location" in data:
        photo.location = data["location"]

    db.session.commit()
    return jsonify({"photo": photo.to_dict()})


@photos_bp.route("/<int:photo_id>", methods=["DELETE"])
@jwt_required()
def delete_photo(photo_id):
    user_id = int(get_jwt_identity())
    photo = Photo.query.filter_by(id=photo_id, user_id=user_id).first_or_404()

    # Delete files
    for path in [photo.filepath, photo.thumbnail_path]:
        if path and os.path.exists(path):
            try:
                os.remove(path)
            except Exception:
                pass

    db.session.delete(photo)
    db.session.commit()
    return jsonify({"message": "Photo deleted"})


@photos_bp.route("/file/<filename>", methods=["GET"])
@jwt_required()
def serve_photo(filename):
    upload_folder = current_app.config["UPLOAD_FOLDER"]
    filepath = os.path.join(upload_folder, filename)
    if not os.path.exists(filepath):
        return jsonify({"error": "Not found"}), 404
    return send_file(filepath)


@photos_bp.route("/thumbnail/<filename>", methods=["GET"])
@jwt_required()
def serve_thumbnail(filename):
    thumb_folder = current_app.config["THUMBNAIL_FOLDER"]
    filepath = os.path.join(thumb_folder, f"thumb_{filename}")
    if not os.path.exists(filepath):
        # Fall back to original
        upload_folder = current_app.config["UPLOAD_FOLDER"]
        filepath = os.path.join(upload_folder, filename)
    if not os.path.exists(filepath):
        return jsonify({"error": "Not found"}), 404
    return send_file(filepath)


@photos_bp.route("/face/<int:face_id>", methods=["GET"])
@jwt_required()
def serve_face(face_id):
    face = PhotoFace.query.get_or_404(face_id)
    if not face.face_image_path or not os.path.exists(face.face_image_path):
        return jsonify({"error": "Face image not found"}), 404
    return send_file(face.face_image_path)


@photos_bp.route("/faces/<int:photo_id>/assign", methods=["POST"])
@jwt_required()
def assign_face(photo_id):
    """Assign a face in a photo to a known or new person."""
    user_id = int(get_jwt_identity())
    Photo.query.filter_by(id=photo_id, user_id=user_id).first_or_404()

    data = request.get_json()
    face_id = data.get("face_id")
    person_id = data.get("person_id")
    new_person_name = data.get("new_person_name")

    face = PhotoFace.query.get_or_404(face_id)

    if new_person_name:
        person = Person(name=new_person_name, user_id=user_id)
        if face.embedding:
            person.face_embedding = face.embedding
        if face.face_image_path:
            person.representative_face = face.face_image_path
        db.session.add(person)
        db.session.flush()
        person_id = person.id

    face.person_id = person_id
    db.session.commit()

    return jsonify({"face": face.to_dict()})


@photos_bp.route("/reprocess/<int:photo_id>", methods=["POST"])
@jwt_required()
def reprocess_faces(photo_id):
    """Re-run face recognition on a photo."""
    user_id = int(get_jwt_identity())
    photo = Photo.query.filter_by(id=photo_id, user_id=user_id).first_or_404()

    # Remove old faces
    PhotoFace.query.filter_by(photo_id=photo_id).delete()

    upload_folder = current_app.config["UPLOAD_FOLDER"]
    _process_faces_inline(photo, user_id, upload_folder)
    db.session.commit()

    return jsonify({"photo": photo.to_dict()})


@photos_bp.route("/stats", methods=["GET"])
@jwt_required()
def get_stats():
    user_id = int(get_jwt_identity())
    total_photos = Photo.query.filter_by(user_id=user_id).count()
    processed = Photo.query.filter_by(user_id=user_id, face_processed=True).count()
    persons_count = Person.query.filter_by(user_id=user_id).count()
    faces_tagged = PhotoFace.query.join(Photo).filter(
        Photo.user_id == user_id, PhotoFace.person_id.isnot(None)
    ).count()
    faces_unknown = PhotoFace.query.join(Photo).filter(
        Photo.user_id == user_id, PhotoFace.person_id.is_(None)
    ).count()

    return jsonify({
        "total_photos": total_photos,
        "processed": processed,
        "persons_count": persons_count,
        "faces_tagged": faces_tagged,
        "faces_unknown": faces_unknown,
    })
