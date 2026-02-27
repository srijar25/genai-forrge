"""
AI Chat routes - Natural language photo queries using Groq
"""
import json
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db
from models import ChatSession, ChatMessage, Photo, Person, PhotoFace

chat_bp = Blueprint("chat", __name__)


SYSTEM_PROMPT = """You are Drishyamitra's AI assistant - a smart photo management companion.
You help users find, organize, and share their photos through natural conversation.

You can perform these actions:
- SEARCH: Find photos by person name, date, tag, or description
- SHARE: Send photos via email or WhatsApp
- ORGANIZE: Tag, caption, or group photos
- INFO: Answer questions about the photo collection
- STATS: Give collection statistics

When a user asks something, respond with a JSON object:
{
  "response": "Your friendly response text",
  "action": "SEARCH|SHARE|ORGANIZE|INFO|STATS|NONE",
  "params": {
    // For SEARCH: {"person_name": "...", "date_from": "YYYY-MM-DD", "date_to": "YYYY-MM-DD", "tags": [], "query": "..."}
    // For SHARE: {"person_name": "...", "platform": "email|whatsapp", "recipient": "..."}
    // For ORGANIZE: {"photo_ids": [], "tags": [], "caption": "..."}
  }
}

Be warm, helpful, and conversational. Use the user's photo collection context provided.
Always respond in valid JSON.
"""


def get_groq_client():
    from groq import Groq
    return Groq(api_key=current_app.config["GROQ_API_KEY"])


def parse_nl_query(user_message: str, context: dict) -> dict:
    """Send message to Groq and parse the action."""
    try:
        client = get_groq_client()
        context_str = json.dumps(context)

        completion = client.chat.completions.create(
            model=current_app.config.get("GROQ_MODEL", "llama3-70b-8192"),
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": f"Context: {context_str}\n\nUser message: {user_message}"},
            ],
            response_format={"type": "json_object"},
            temperature=0.3,
            max_tokens=500,
        )

        content = completion.choices[0].message.content
        return json.loads(content)

    except Exception as e:
        current_app.logger.error(f"Groq error: {e}")
        return {
            "response": "I'm having trouble understanding that right now. Could you rephrase?",
            "action": "NONE",
            "params": {},
        }


def execute_action(action: str, params: dict, user_id: int) -> dict:
    """Execute the parsed action and return photo results."""
    result = {"photos": [], "message": ""}

    if action == "SEARCH":
        query = Photo.query.filter_by(user_id=user_id)

        # Filter by person name
        person_name = params.get("person_name")
        if person_name:
            person = Person.query.filter(
                Person.user_id == user_id,
                Person.name.ilike(f"%{person_name}%")
            ).first()
            if person:
                photo_ids = [pf.photo_id for pf in PhotoFace.query.filter_by(person_id=person.id).all()]
                query = query.filter(Photo.id.in_(photo_ids))
            else:
                result["message"] = f"I couldn't find anyone named '{person_name}' in your collection."
                return result

        # Date filters
        date_from = params.get("date_from")
        date_to = params.get("date_to")
        if date_from:
            try:
                query = query.filter(Photo.uploaded_at >= datetime.fromisoformat(date_from))
            except Exception:
                pass
        if date_to:
            try:
                query = query.filter(Photo.uploaded_at <= datetime.fromisoformat(date_to))
            except Exception:
                pass

        # Tag/text search
        search_q = params.get("query", "")
        if search_q:
            query = query.filter(
                db.or_(
                    Photo.caption.ilike(f"%{search_q}%"),
                    Photo.tags.ilike(f"%{search_q}%"),
                )
            )

        photos = query.order_by(Photo.uploaded_at.desc()).limit(20).all()
        result["photos"] = [p.to_dict() for p in photos]

    elif action == "STATS":
        total = Photo.query.filter_by(user_id=user_id).count()
        persons = Person.query.filter_by(user_id=user_id).count()
        result["stats"] = {"total_photos": total, "persons": persons}

    return result


def get_user_context(user_id: int) -> dict:
    """Build a brief context summary for the LLM."""
    persons = Person.query.filter_by(user_id=user_id).all()
    total_photos = Photo.query.filter_by(user_id=user_id).count()
    return {
        "total_photos": total_photos,
        "known_persons": [{"id": p.id, "name": p.name} for p in persons],
    }


@chat_bp.route("/sessions", methods=["GET"])
@jwt_required()
def list_sessions():
    user_id = int(get_jwt_identity())
    sessions = ChatSession.query.filter_by(user_id=user_id).order_by(ChatSession.updated_at.desc()).limit(20).all()
    return jsonify({
        "sessions": [
            {
                "id": s.id,
                "title": s.title or "New Chat",
                "updated_at": s.updated_at.isoformat(),
                "message_count": len(s.messages),
            }
            for s in sessions
        ]
    })


@chat_bp.route("/sessions", methods=["POST"])
@jwt_required()
def create_session():
    user_id = int(get_jwt_identity())
    session = ChatSession(user_id=user_id, title="New Chat")
    db.session.add(session)
    db.session.commit()
    return jsonify({"session_id": session.id}), 201


@chat_bp.route("/sessions/<int:session_id>/messages", methods=["GET"])
@jwt_required()
def get_messages(session_id):
    user_id = int(get_jwt_identity())
    session = ChatSession.query.filter_by(id=session_id, user_id=user_id).first_or_404()
    messages = ChatMessage.query.filter_by(session_id=session_id).order_by(ChatMessage.created_at).all()
    return jsonify({"messages": [m.to_dict() for m in messages]})


@chat_bp.route("/sessions/<int:session_id>/send", methods=["POST"])
@jwt_required()
def send_message(session_id):
    user_id = int(get_jwt_identity())
    session = ChatSession.query.filter_by(id=session_id, user_id=user_id).first_or_404()

    data = request.get_json()
    user_text = data.get("message", "").strip()
    if not user_text:
        return jsonify({"error": "Message cannot be empty"}), 400

    # Save user message
    user_msg = ChatMessage(session_id=session_id, role="user", content=user_text)
    db.session.add(user_msg)

    # Update session title from first message
    if not session.title or session.title == "New Chat":
        session.title = user_text[:60]

    # Get context and call Groq
    context = get_user_context(user_id)
    parsed = parse_nl_query(user_text, context)

    action = parsed.get("action", "NONE")
    params = parsed.get("params", {})
    response_text = parsed.get("response", "I'm not sure how to help with that.")

    # Execute action
    action_result = execute_action(action, params, user_id) if action != "NONE" else {}

    # Save assistant message
    assistant_msg = ChatMessage(
        session_id=session_id,
        role="assistant",
        content=response_text,
        action_type=action,
        action_data=json.dumps(params) if params else None,
        photo_results=json.dumps([p["id"] for p in action_result.get("photos", [])]) if action_result.get("photos") else None,
    )
    db.session.add(assistant_msg)
    db.session.commit()

    return jsonify({
        "message": assistant_msg.to_dict(),
        "photos": action_result.get("photos", []),
        "stats": action_result.get("stats"),
    })


@chat_bp.route("/quick-query", methods=["POST"])
@jwt_required()
def quick_query():
    """Single-shot query without session management."""
    user_id = int(get_jwt_identity())
    data = request.get_json()
    user_text = data.get("message", "").strip()

    if not user_text:
        return jsonify({"error": "Message required"}), 400

    context = get_user_context(user_id)
    parsed = parse_nl_query(user_text, context)

    action = parsed.get("action", "NONE")
    params = parsed.get("params", {})
    action_result = execute_action(action, params, user_id) if action != "NONE" else {}

    return jsonify({
        "response": parsed.get("response"),
        "action": action,
        "photos": action_result.get("photos", []),
    })
