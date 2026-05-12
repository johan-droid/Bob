# Bob Frontend - PR Health Monitor Dashboard

Real-time dashboard with WebSocket for instant PR health updates.

## Features

- **Real-time Updates** - WebSocket connection for instant updates
- **Mobile Optimized** - Responsive design for all screen sizes
- **Connection Status** - Visual indicator for WebSocket connection
- **Auto-reconnect** - Automatic reconnection on disconnect
- **No API Keys** - Direct WebSocket connection

## Status Indicators

| Dot Color | Status | Meaning |
|-----------|--------|---------|
| 🔴 Red | Active/Failed | Needs attention |
| 🟢 Green | In Progress | Being worked on |
| ⚪ Grey | Resolved | Successfully fixed |

## Setup

1. Ensure backend is running on `http://localhost:5000`

2. Open `index.html` in browser or serve with:
```bash
# Python
python -m http.server 8000

# Node.js
npx http-server
```

3. Access dashboard at `http://localhost:8000`

## Mobile Support

- Responsive grid layout
- Touch-friendly interface
- Optimized font sizes
- Viewport meta tags for mobile browsers

## Configuration

Edit WebSocket URL in `app.js`:
```javascript
const socket = io('http://localhost:5000');
```

## Connection Status

Green badge = Connected to server
Red badge = Disconnected from server
