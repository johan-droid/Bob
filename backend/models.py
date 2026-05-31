"""models.py — SQLAlchemy ORM models for Bob PR Health Scanner."""
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()


class User(db.Model):
    __tablename__ = 'users'
    id         = db.Column(db.Integer, primary_key=True)
    github_id  = db.Column(db.Integer, unique=True, nullable=False)
    username   = db.Column(db.String(255), unique=True, nullable=False)
    avatar     = db.Column(db.String(500))
    name       = db.Column(db.String(255))
    email      = db.Column(db.String(255))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_login = db.Column(db.DateTime, default=datetime.utcnow)
    access_token = db.Column(db.String(255), nullable=True)

    repos    = db.relationship('UserRepo',     backref='user', lazy='dynamic', cascade='all, delete-orphan')
    issues   = db.relationship('PRIssue',      backref='user', lazy='dynamic', cascade='all, delete-orphan')
    settings = db.relationship('UserSettings', backref='user', uselist=False,  cascade='all, delete-orphan')


class UserRepo(db.Model):
    __tablename__ = 'user_repos'
    id                = db.Column(db.Integer, primary_key=True)
    user_id           = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    full_name         = db.Column(db.String(500), nullable=False)
    private           = db.Column(db.Boolean, default=False)
    url               = db.Column(db.String(500))
    language          = db.Column(db.String(100), default='Unknown')
    permissions_level = db.Column(db.String(50),  default='read')
    agent_permission = db.Column(db.String(50), default='none')
    archived          = db.Column(db.Boolean, default=False)
    fork              = db.Column(db.Boolean, default=False)
    last_synced       = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (db.UniqueConstraint('user_id', 'full_name', name='uq_user_repo'),)


class PRIssue(db.Model):
    __tablename__ = 'pr_issues'
    id         = db.Column(db.Integer, primary_key=True)
    user_id    = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    repo       = db.Column(db.String(500), nullable=False)
    issue_key  = db.Column(db.String(500), nullable=False)  # repo#pr_number | repo#run_id
    title      = db.Column(db.String(1000))
    url        = db.Column(db.String(500))
    branch     = db.Column(db.String(500))
    pr_number  = db.Column(db.Integer)
    run_id     = db.Column(db.String(100))
    issue_type = db.Column(db.String(50))   # merge_conflict | ci_failure
    status     = db.Column(db.String(50), default='pending')  # pending|in_progress|failed|resolved
    author     = db.Column(db.String(255))
    comment_sent = db.Column(db.Boolean, default=False) # Legacy (keeping for compat)
    last_commented_at = db.Column(db.DateTime, nullable=True)
    comment_count = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (db.UniqueConstraint('user_id', 'issue_key', name='uq_user_issue'),)

    def to_dict(self):
        return {
            'id':         self.id,
            'repo':       self.repo,
            'issue_key':  self.issue_key,
            'title':      self.title,
            'url':        self.url,
            'branch':     self.branch,
            'pr_number':  self.pr_number,
            'run_id':     self.run_id,
            'type':       self.issue_type,
            'status':     self.status,
            'author':     self.author,
            'last_commented_at': self.last_commented_at.isoformat() if self.last_commented_at else None,
            'comment_count': self.comment_count or 0,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }


class UserSettings(db.Model):
    __tablename__ = 'user_settings'
    id                = db.Column(db.Integer, primary_key=True)
    user_id           = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, unique=True)
    scan_interval     = db.Column(db.Integer, default=300)
    excluded_repos    = db.Column(db.Text, default='')   # comma-separated
    notify_in_app     = db.Column(db.Boolean, default=True)
    push_subscription = db.Column(db.Text)               # JSON push subscription
    slack_webhook     = db.Column(db.String(500))
    discord_webhook   = db.Column(db.String(500))
    auto_label_conflict = db.Column(db.Boolean, default=True)
    tag_author_on_fail  = db.Column(db.Boolean, default=False)
    created_at        = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at        = db.Column(db.DateTime, default=datetime.utcnow)

    def get_excluded_list(self):
        return [r.strip() for r in (self.excluded_repos or '').split(',') if r.strip()]

    def get_excluded_set(self):
        """Return excluded repos as a set for O(1) lookup performance."""
        return {r.strip() for r in (self.excluded_repos or '').split(',') if r.strip()}
