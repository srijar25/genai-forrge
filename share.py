"""
Share routes - Send photos via Email or WhatsApp
"""
import os
import uuid
import json
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db
from models import Photo, Person, PhotoFace, ShareLog

share_bp = Blueprint("share", __name__)


def send_email_photos(recipient: str, photo_paths: list, message: str, sender_name: str):
    """Send photos via SMTP email."""
    config = current_app.config

    msg = MIMEMultipart()
    msg["From"] = f"{sender_name} via Drishyamitra <{config['MAIL_USERNAME']}>"
    msg["To"] = recipient
    msg["Subject"] = f"📸 Photos shared by {sender_name}"

    body = f"""
<html><body>
<h2 style="color:#6366f1;">📸 Photos from Drishyamitra</h2>
<p>{message or f'{sender_name} shared some photos with you!'}</p>
<p style="color:#888;font-size:12px;">Sent via Drishyamitra - AI Photo Management</p>
</body></html>
"""
    msg.attach(MIMEText(body, "html"))

    for photo_path in photo_paths:
        if not os.path.exists(photo_path):
            continue
        with open(photo_path, "rb") as f:
            part = MIMEBase("application", "octet-stream")
            part.set_payload(f.read())
        encoders.encode_base64(part)
        filename = os.path.basename(photo_path)
        part.add_header("Content-Disposition", f"attachment; filename={filename}")
        msg.attach(part)

    with smtplib.SMTP(config["MAIL_SERVER"], config["MAIL_PORT"]) as server:
        server.starttls()
        server.login(config["MAIL_USERNAME"], config["MAIL_PASSWORD"])
        server.sendmail(config["MAIL_USERNAME"], recipient, msg.as_string())


def send_whatsapp_photos(recipient: str, photo_paths: list, message: str):
    """Send photos via Twilio WhatsApp API."""
    from twilio.rest import Client

    config = current_app.config
    client = Client(config["TWILIO_ACCOUNT_SID"], config["TWILIO_AUTH_TOKEN"])

    whatsapp_to = f"whatsapp:{recipient}" if not recipient.startswith("whatsapp:") else recipient

    # Twilio requires publicly accessible URLs; in production use S3/CDN
    # For demo we send message + note
    body = message or "📸 Photos shared via Drishyamitra"
    client.messages.create(
        from_=config["TWILIO_WHATSAPP_FROM"],
        to=whatsapp_to,
        body=f"{body}\n\n[{len(photo_paths)} photo(s) attached — use production server for media URLs]",
    )


@share_bp.route("/send", methods=["POST"])
@jwt_required()
def share_photos():
    user_id = int(get_jwt_identity())
    data = request.get_json()

    photo_ids = data.get("photo_ids", [])
    platform = data.get("platform", "email")  # email | whatsapp
    recipient = data.get("recipient", "")
    message = data.get("message", "")
    person_id = data.get("person_id")  # Share all photos of a person

    if not recipient:
        return jsonify({"error": "Recipient is required"}), 400

    # Resolve photos
    if person_id and not photo_ids:
        face_records = PhotoFace.query.filter_by(person_id=person_id).all()
        photo_ids = list({f.photo_id for f in face_records})

    photos = Photo.query.filter(
        Photo.id.in_(photo_ids),
        Photo.user_id == user_id
    ).all()

    if not photos:
        return jsonify({"error": "No photos found"}), 404

    photo_paths = [p.filepath for p in photos if os.path.exists(p.filepath)]
    batch_id = uuid.uuid4().hex

    try:
        from models import User
        user = User.query.get(user_id)
        sender_name = user.username if user else "Someone"

        if platform == "email":
            send_email_photos(recipient, photo_paths, message, sender_name)
        elif platform == "whatsapp":
            send_whatsapp_photos(recipient, photo_paths, message)
        else:
            return jsonify({"error": f"Unknown platform: {platform}"}), 400

        status = "sent"
    except Exception as e:
        current_app.logger.error(f"Share error: {e}")
        status = "failed"

    # Log all shares
    for photo in photos:
        log = ShareLog(
            user_id=user_id,
            photo_id=photo.id,
            platform=platform,
            recipient=recipient,
            status=status,
            message=message,
            batch_id=batch_id,
        )
        db.session.add(log)

    db.session.commit()

    if status == "failed":
        return jsonify({"error": "Failed to send. Check server configuration."}), 500

    return jsonify({
        "message": f"Successfully sent {len(photos)} photo(s) via {platform}",
        "batch_id": batch_id,
        "count": len(photos),
    })


@share_bp.route("/history", methods=["GET"])
@jwt_required()
def share_history():
    user_id = int(get_jwt_identity())
    logs = ShareLog.query.filter_by(user_id=user_id).order_by(ShareLog.shared_at.desc()).limit(50).all()
    return jsonify({"history": [log.to_dict() for log in logs]})
