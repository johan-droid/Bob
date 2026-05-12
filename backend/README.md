# Bob Backend - PR Health Scanner with WebSocket

Flask-based server with WebSocket support for real-time PR health monitoring.

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Configure environment:
```bash
cp .env.example .env
# Edit .env with your GITHUB_TOKEN and TARGET_REPOS
```

3. Start server:
```bash
python api_server.py
```

Server runs on `http://localhost:5000`

## Features

- **WebSocket Support** - Real-time updates without polling
- **No API Keys** - Direct WebSocket connection
- **Background Scanning** - Automatic repo scanning every 5 minutes
- **Instant Updates** - Changes broadcast to all connected clients

## WebSocket Events

### Client → Server
- `connect` - Establish connection
- `request_update` - Request current data
- `update_status` - Update PR status

### Server → Client
- `update` - Full data update
- `scan_complete` - Scan finished notification

## REST Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Dashboard UI |
| GET | `/api/health` | Health check |
| POST | `/api/scan` | Trigger manual scan |

## Configuration

```bash
GITHUB_TOKEN=your_org_level_pat
TARGET_REPOS=org/repo1,org/repo2,org/repo3
```
