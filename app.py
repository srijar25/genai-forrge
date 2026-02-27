"""
Drishyamitra - AI Photo Management System
Main Flask Application
"""

from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from config import Config
from extensions import db
from routes.auth import auth_bp
from routes.photos import photos_bp
from routes.persons import persons_bp
from routes.chat import chat_bp
from routes.share import share_bp


def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    # Extensions
    CORS(app, origins=["http://localhost:3000"], supports_credentials=True)
    db.init_app(app)
    JWTManager(app)

    # Register blueprints
    app.register_blueprint(auth_bp,    prefix="/api/auth")
    app.register_blueprint(photos_bp,  url_prefix="/api/photos")
    app.register_blueprint(persons_bp, url_prefix="/api/persons")
    app.register_blueprint(chat_bp,    url_prefix="/api/chat")
    app.register_blueprint(share_bp,   url_prefix="/api/share")

    # Create DB tables
    with app.app_context():
        db.create_all()

    return app


if __name__ == "__main__":
    app = create_app()
    app.run(debug=True, host="0.0.0.0", port=5000)
