"""
Person management routes
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db
from models import Person, Photo, PhotoFace

persons_bp = Blueprint("persons", __name__)


@persons_bp.route("/", methods=["GET"])
@jwt_required()
def list_persons():
    user_id = int(get_jwt_identity())
    persons = Person.query.filter_by(user_id=user_id).order_by(Person.name).all()
    return jsonify({"persons": [p.to_dict() for p in persons]})


@persons_bp.route("/", methods=["POST"])
@jwt_required()
def create_person():
    user_id = int(get_jwt_identity())
    data = request.get_json()

    if not data or not data.get("name"):
        return jsonify({"error": "Name is required"}), 400

    person = Person(
        name=data["name"],
        relation=data.get("relation"),
        notes=data.get("notes"),
        user_id=user_id,
    )
    db.session.add(person)
    db.session.commit()
    return jsonify({"person": person.to_dict()}), 201


@persons_bp.route("/<int:person_id>", methods=["GET"])
@jwt_required()
def get_person(person_id):
    user_id = int(get_jwt_identity())
    person = Person.query.filter_by(id=person_id, user_id=user_id).first_or_404()

    # Get photos for this person
    photo_faces = PhotoFace.query.filter_by(person_id=person_id).all()
    photo_ids = list({pf.photo_id for pf in photo_faces})
    photos = Photo.query.filter(Photo.id.in_(photo_ids), Photo.user_id == user_id).order_by(Photo.uploaded_at.desc()).limit(50).all()

    return jsonify({
        "person": person.to_dict(),
        "photos": [p.to_dict() for p in photos],
    })


@persons_bp.route("/<int:person_id>", methods=["PUT"])
@jwt_required()
def update_person(person_id):
    user_id = int(get_jwt_identity())
    person = Person.query.filter_by(id=person_id, user_id=user_id).first_or_404()
    data = request.get_json()

    if "name" in data:
        person.name = data["name"]
    if "relation" in data:
        person.relation = data["relation"]
    if "notes" in data:
        person.notes = data["notes"]

    db.session.commit()
    return jsonify({"person": person.to_dict()})


@persons_bp.route("/<int:person_id>", methods=["DELETE"])
@jwt_required()
def delete_person(person_id):
    user_id = int(get_jwt_identity())
    person = Person.query.filter_by(id=person_id, user_id=user_id).first_or_404()

    # Unlink faces but keep photos
    PhotoFace.query.filter_by(person_id=person_id).update({"person_id": None})

    db.session.delete(person)
    db.session.commit()
    return jsonify({"message": "Person deleted"})


@persons_bp.route("/merge", methods=["POST"])
@jwt_required()
def merge_persons():
    """Merge two persons into one (useful for duplicate detection)."""
    user_id = int(get_jwt_identity())
    data = request.get_json()

    keep_id = data.get("keep_id")
    remove_id = data.get("remove_id")

    if not keep_id or not remove_id:
        return jsonify({"error": "keep_id and remove_id required"}), 400

    keep = Person.query.filter_by(id=keep_id, user_id=user_id).first_or_404()
    remove = Person.query.filter_by(id=remove_id, user_id=user_id).first_or_404()

    # Reassign all faces
    PhotoFace.query.filter_by(person_id=remove_id).update({"person_id": keep_id})
    db.session.delete(remove)
    db.session.commit()

    return jsonify({"person": keep.to_dict()})
