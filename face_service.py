"""
Drishyamitra Face Recognition Service
Uses DeepFace with Facenet512 + RetinaFace
"""
import os
import json
import uuid
import numpy as np
from flask import current_app
from typing import Optional, List, Dict, Tuple


def get_deepface():
    """Lazy import DeepFace to avoid slow startup"""
    from deepface import DeepFace
    return DeepFace


def detect_faces(image_path: str) -> List[Dict]:
    """
    Detect all faces in an image.
    Returns list of dicts with bbox, confidence, embedding.
    """
    DeepFace = get_deepface()
    try:
        results = DeepFace.extract_faces(
            img_path=image_path,
            detector_backend=current_app.config.get("DEEPFACE_DETECTOR", "retinaface"),
            enforce_detection=False,
            align=True,
        )
        faces = []
        for r in results:
            if r.get("confidence", 0) < 0.7:
                continue
            facial_area = r.get("facial_area", {})
            faces.append({
                "bbox": {
                    "x": facial_area.get("x", 0),
                    "y": facial_area.get("y", 0),
                    "w": facial_area.get("w", 0),
                    "h": facial_area.get("h", 0),
                },
                "confidence": r.get("confidence", 0),
                "face_array": r.get("face", None),  # numpy array
            })
        return faces
    except Exception as e:
        current_app.logger.error(f"Face detection error: {e}")
        return []


def get_embedding(image_path: str) -> Optional[List[float]]:
    """Get face embedding vector from an image (assumes single face or use best)."""
    DeepFace = get_deepface()
    try:
        result = DeepFace.represent(
            img_path=image_path,
            model_name=current_app.config.get("DEEPFACE_MODEL", "Facenet512"),
            detector_backend=current_app.config.get("DEEPFACE_DETECTOR", "retinaface"),
            enforce_detection=False,
            align=True,
        )
        if result:
            return result[0]["embedding"]
        return None
    except Exception as e:
        current_app.logger.error(f"Embedding error: {e}")
        return None


def get_embedding_from_array(face_array) -> Optional[List[float]]:
    """Get embedding from a numpy face array."""
    import tempfile
    import cv2
    DeepFace = get_deepface()
    try:
        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
            tmp_path = tmp.name
        cv2.imwrite(tmp_path, (face_array * 255).astype(np.uint8))
        embedding = get_embedding(tmp_path)
        os.unlink(tmp_path)
        return embedding
    except Exception as e:
        current_app.logger.error(f"Array embedding error: {e}")
        return None


def cosine_similarity(emb1: List[float], emb2: List[float]) -> float:
    """Compute cosine similarity between two embeddings."""
    a = np.array(emb1)
    b = np.array(emb2)
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-10))


def find_matching_person(embedding: List[float], persons, threshold: float = 0.6) -> Tuple[Optional[int], float]:
    """
    Compare embedding against all known persons.
    Returns (person_id, similarity) or (None, 0).
    """
    best_person_id = None
    best_similarity = 0.0

    for person in persons:
        if not person.face_embedding:
            continue
        try:
            stored_emb = json.loads(person.face_embedding)
            sim = cosine_similarity(embedding, stored_emb)
            if sim > best_similarity:
                best_similarity = sim
                best_person_id = person.id
        except Exception:
            continue

    if best_similarity >= threshold:
        return best_person_id, best_similarity
    return None, best_similarity


def save_face_image(face_array, base_folder: str) -> str:
    """Save a face crop to disk, return relative path."""
    import cv2
    faces_dir = os.path.join(base_folder, "faces")
    os.makedirs(faces_dir, exist_ok=True)
    filename = f"face_{uuid.uuid4().hex}.jpg"
    filepath = os.path.join(faces_dir, filename)
    img_uint8 = (face_array * 255).astype(np.uint8)
    cv2.imwrite(filepath, img_uint8)
    return filepath


def process_photo_faces(photo_path: str, user_id: int, upload_folder: str):
    """
    Full pipeline: detect faces, match to known persons, return structured results.
    Called after photo upload.
    """
    from models import Person
    from flask import current_app

    persons = Person.query.filter_by(user_id=user_id).all()
    raw_faces = detect_faces(photo_path)
    processed = []

    for face_data in raw_faces:
        face_array = face_data.get("face_array")
        embedding = None
        face_image_path = None

        if face_array is not None:
            try:
                face_image_path = save_face_image(face_array, upload_folder)
                embedding = get_embedding_from_array(face_array)
            except Exception as e:
                current_app.logger.error(f"Face save/embed error: {e}")

        person_id = None
        confidence = face_data.get("confidence", 0)

        if embedding:
            person_id, similarity = find_matching_person(
                embedding, persons,
                threshold=current_app.config.get("FACE_SIMILARITY_THRESHOLD", 0.6)
            )
            if person_id:
                confidence = similarity

        processed.append({
            "bbox": face_data["bbox"],
            "confidence": confidence,
            "person_id": person_id,
            "face_image_path": face_image_path,
            "embedding": json.dumps(embedding) if embedding else None,
        })

    return processed
