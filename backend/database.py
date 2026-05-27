"""database.py — DB engine initialization for Bob."""

try:
    from .models import db
except ImportError:
    from models import db


def init_db(app):
    """Bind SQLAlchemy to the Flask app and create all tables."""
    db.init_app(app)
    with app.app_context():
        db.create_all()
