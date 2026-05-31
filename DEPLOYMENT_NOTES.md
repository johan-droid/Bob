# Deployment Infrastructure Notes

## Required Environment Variables for Production

### TOKEN_ENCRYPTION_KEY (CRITICAL)

**Why it's required:** The `TOKEN_ENCRYPTION_KEY` is used to encrypt GitHub OAuth tokens stored in the database. Without a persistent key, all user tokens become unreadable after any server restart or redeployment.

**How to generate:**
```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

**Example output:**
```
FhI_5K8yqZ9X2mN7pL4vR1wQ6tY3uE0sA8bC9dD2fG4=
```

**Deployment configuration:**

- **Render:** Add as an environment variable in the Render dashboard under "Environment"
- **Heroku:** `heroku config:set TOKEN_ENCRYPTION_KEY=<your-generated-key>`
- **Docker:** Pass via `-e TOKEN_ENCRYPTION_KEY=<key>` or in docker-compose.yml

**Warning:** If you deploy without this variable, the application will fail to start with a clear error message directing you to generate one.

## Database Cascade Configuration

The SQLAlchemy models are configured with `cascade='all,delete-orphan'` on all User relationships:

- `User.repos` → `UserRepo`
- `User.issues` → `PRIssue`  
- `User.settings` → `UserSettings`

When a user account is deleted via `/api/account/delete`, all related data is automatically cleaned up:

1. User record is deleted
2. All associated repositories are deleted
3. All associated PR/issues are deleted
4. User settings are deleted

This prevents orphaned data and integrity constraint violations.

## Verification

To verify cascade delete is working:

```python
from api_server import app, db
from models import User, UserRepo, PRIssue, UserSettings

with app.app_context():
    # Create test user with related data
    user = User(github_id=123, username='test', access_token='token')
    db.session.add(user)
    db.session.commit()
    
    # Add related records
    db.session.add(UserRepo(user_id=user.id, full_name='test/repo'))
    db.session.add(PRIssue(user_id=user.id, repo='test/repo', issue_key='r#1'))
    db.session.add(UserSettings(user_id=user.id))
    db.session.commit()
    
    # Delete user - cascade handles the rest
    db.session.delete(user)
    db.session.commit()
    
    # Verify all related data is gone
    assert UserRepo.query.filter_by(user_id=user.id).count() == 0
    assert PRIssue.query.filter_by(user_id=user.id).count() == 0
    assert UserSettings.query.filter_by(user_id=user.id).count() == 0
```
