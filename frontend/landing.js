// WebSocket connection for landing page
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const wsUrl = window.location.hostname === 'localhost' 
    ? 'http://localhost:5000' 
    : window.location.origin;
const socket = io(wsUrl, {
    transports: ['websocket', 'polling'],
    upgrade: true,
    withCredentials: true
});

const liveIndicator = document.getElementById('live-indicator');
const liveText = document.querySelector('.live-text');

// Connection status handlers
socket.on('connect', () => {
    console.log('Connected to Bob server');
    liveIndicator.className = 'live-dot connected';
    liveText.textContent = 'Live';
    socket.emit('request_update');
});

socket.on('disconnect', () => {
    console.log('Disconnected from Bob server');
    liveIndicator.className = 'live-dot disconnected';
    liveText.textContent = 'Offline';
    
    // Reset values to dash
    document.getElementById('preview-pending').textContent = '-';
    document.getElementById('preview-in-progress').textContent = '-';
    document.getElementById('preview-resolved').textContent = '-';
});

socket.on('connect_error', (err) => {
    console.warn('Socket connection error:', err);
    liveIndicator.className = 'live-dot disconnected';
    liveText.textContent = 'Retrying...';
    // Force a fresh connection attempt
    setTimeout(() => socket.connect(), 5000);
});

// Receive real-time updates
socket.on('update', (data) => {
    console.log('Received update:', data);
    updatePreview(data);
});

// Update preview with live data
function updatePreview(data) {
    if (data.stats) {
        document.getElementById('preview-pending').textContent = data.stats.pending || 0;
        document.getElementById('preview-in-progress').textContent = data.stats.in_progress || 0;
        document.getElementById('preview-resolved').textContent = data.stats.resolved || 0;
    }
}

// Request update every 30 seconds
setInterval(() => {
    if (socket.connected) {
        socket.emit('request_update');
    }
}, 30000);
