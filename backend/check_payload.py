from api_server import _get_user_data, app
from models import User

with app.app_context():
    user = User.query.first()
    if user:
        print(_get_user_data(user.id))
