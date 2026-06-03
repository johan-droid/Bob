import os

bind = f"0.0.0.0:{os.environ.get('PORT', '5000')}"
worker_class = "gthread"
threads = int(os.environ.get("GUNICORN_THREADS", "8"))
workers = int(os.environ.get("WEB_CONCURRENCY", "1"))
timeout = int(os.environ.get("GUNICORN_TIMEOUT", "120"))
