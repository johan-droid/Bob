require('dotenv').config();
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

const SECRET_KEY = process.env.SECRET_KEY || 'default-secret-key-change-me-in-production';
const SCAN_INTERVAL = parseInt(process.env.SCAN_INTERVAL || '300', 10);

// Helper to parse cookies from header
function parseCookies(cookieHeader) {
  const list = {};
  if (!cookieHeader) return list;
  cookieHeader.split(';').forEach(cookie => {
    const parts = cookie.split('=');
    list[parts.shift().trim()] = decodeURI(parts.join('='));
  });
  return list;
}

// Delayed dynamic import of db and scanner
let queryDb;
let runScanForUser;
let getUserDashboardData;
let initDatabase;

app.prepare().then(async () => {
  // Dynamically import database and scanner logic
  const db = require('./lib/db');
  const scanner = require('./lib/scanner');
  
  queryDb = db.query;
  initDatabase = db.initDatabase;
  runScanForUser = scanner.runScanForUser;
  getUserDashboardData = scanner.getUserDashboardData;

  // Initialize DB tables
  try {
    await initDatabase();
    console.log('> Database initialized successfully.');
  } catch (err) {
    console.error('> Database initialization failed:', err);
  }

  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  const io = new Server(server, {
    path: '/socket.io',
    transports: ['websocket', 'polling']
  });

  // Attach socket emitter to global object so API routes can emit updates
  global.socketEmitter = (username, event, data) => {
    io.to(username).emit(event, data);
  };

  io.on('connection', async (socket) => {
    const cookieHeader = socket.handshake.headers.cookie;
    const cookies = parseCookies(cookieHeader);
    const sessionToken = cookies.session;

    if (!sessionToken) {
      socket.disconnect();
      return;
    }

    let user;
    try {
      user = jwt.verify(sessionToken, SECRET_KEY);
    } catch (err) {
      socket.disconnect();
      return;
    }

    const username = user.username;
    const userId = user.db_id;

    socket.join(username);
    console.log(`> WS Connect: ${username}`);

    try {
      const data = await getUserDashboardData(userId);
      socket.emit('update', data);
    } catch (err) {
      console.error(`> Error emitting WS update for ${username}:`, err);
    }

    socket.on('request_update', async () => {
      try {
        const data = await getUserDashboardData(userId);
        socket.emit('update', data);
      } catch (err) {
        console.error(`> Error handling WS request_update for ${username}:`, err);
      }
    });

    socket.on('disconnect', () => {
      console.log(`> WS Disconnect: ${username}`);
    });
  });

  // ── Background Cron Jobs ──
  async function runBackgroundScan() {
    console.log('> Starting periodic background scan...');
    try {
      const users = await queryDb('SELECT id, username FROM users');
      for (const u of users) {
        console.log(`> BG Scan: running for user ${u.username} (ID: ${u.id})`);
        try {
          await runScanForUser(u.id, global.socketEmitter);
        } catch (err) {
          console.error(`> BG Scan error for user ${u.username}:`, err);
        }
      }
    } catch (err) {
      console.error('> BG Scan: Failed to retrieve users:', err);
    }
  }

  // Schedule scan interval
  if (SCAN_INTERVAL > 0) {
    setInterval(runBackgroundScan, SCAN_INTERVAL * 1000);
    // Optional: run initial scan 5 seconds after startup
    setTimeout(runBackgroundScan, 5000);
  }

  const port = process.env.PORT || 3000;
  server.listen(port, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://localhost:${port}`);
  });
});
