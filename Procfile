<<<<<<< Updated upstream
web: node server.js
=======
web: cd backend && gunicorn -b 0.0.0.0:$PORT --worker-class eventlet -w 1 api_server:app
worker: cd backend && rq worker bob-jobs --url $REDIS_URL
>>>>>>> Stashed changes
