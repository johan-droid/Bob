import 'dotenv/config';
import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server as SocketIOServer } from 'socket.io';
import jwt from 'jsonwebtoken';

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

const SECRET_KEY = process.env.SECRET_KEY;
if ((!SECRET_KEY || SECRET_KEY === 'default-secret-key-change-me-in-production') && process.env.NODE_ENV === 'production') {
  throw new Error('SECRET_KEY is required in production');
}
const EFFECTIVE_SECRET_KEY = SECRET_KEY || 'dev-only-secret-key-not-for-production';
const SCAN_INTERVAL = parseInt(process.env.SCAN_INTERVAL || '300', 10);
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const list: Record<string, string> = {};
  if (!cookieHeader) return list;
  cookieHeader.split(';').forEach((cookie) => {
    const parts = cookie.split('=');
    const key = parts.shift()?.trim();
    if (key) list[key] = decodeURI(parts.join('='));
  });
  return list;
}

function isAllowedOrigin(origin: string | undefined, host: string | undefined): boolean {
  if (!origin) return true;
  try {
    const parsed = new URL(origin);
    return parsed.host === host || ALLOWED_ORIGINS.includes(parsed.origin);
  } catch {
    return false;
  }
}

// Dynamic imports set after Next.js prepares
let queryDb: (sql: string, params?: any[]) => Promise<any[]>;
let runScanForUser: (userId: number, emitter: any) => Promise<void>;
let getUserDashboardData: (userId: number) => Promise<any>;
let initDatabase: () => Promise<void>;

app.prepare().then(async () => {
  // Load TypeScript lib modules via dynamic import (resolved by tsx)
  const db = await import('./lib/db');
  const scanner = await import('./lib/scanner');

  queryDb = db.query;
  initDatabase = db.initDatabase;
  runScanForUser = scanner.runScanForUser;
  getUserDashboardData = scanner.getUserDashboardData;

  // Initialize DB schema
  try {
    await initDatabase();
    console.log('> Database initialized successfully.');
  } catch (err) {
    console.error('> Database initialization failed:', err);
  }

  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  const io = new SocketIOServer(server, {
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    cors: {
      origin: ALLOWED_ORIGINS,
      credentials: true,
    },
    allowRequest: (req: any, callback: (err: string | null, success: boolean) => void) => {
      callback(null, isAllowedOrigin(req.headers.origin, req.headers.host));
    },
  });

  // Expose emitter to Next.js API routes via global
  (global as any).socketEmitter = (username: string, event: string, data: any) => {
    io.to(username).emit(event, data);
  };

  io.on('connection', async (socket) => {
    const cookieHeader = socket.handshake.headers.cookie;
    const cookies = parseCookies(cookieHeader);
    const sessionToken = cookies['session'];

    if (!sessionToken) {
      socket.disconnect();
      return;
    }

    let user: any;
    try {
      user = jwt.verify(sessionToken, EFFECTIVE_SECRET_KEY);
    } catch {
      socket.disconnect();
      return;
    }

    const username: string = user.username;
    const userId: number = user.db_id;

    socket.join(username);
    console.log(`> WS Connect: ${username}`);

    // Push initial data immediately on connect
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
        console.error(`> Error handling request_update for ${username}:`, err);
      }
    });

    socket.on('disconnect', () => {
      console.log(`> WS Disconnect: ${username}`);
    });
  });

  // ── Background Scanner ────────────────────────────────────────────────────
  async function runBackgroundScan() {
    console.log('> Starting periodic background scan...');
    try {
      const users = await queryDb('SELECT id, username FROM users');
      for (const u of users) {
        try {
          await runScanForUser(u.id, (global as any).socketEmitter);
        } catch (err) {
          console.error(`> BG Scan error for user ${u.username}:`, err);
        }
      }
    } catch (err) {
      console.error('> BG Scan: Failed to retrieve users:', err);
    }
  }

  if (SCAN_INTERVAL > 0) {
    setInterval(runBackgroundScan, SCAN_INTERVAL * 1000);
    setTimeout(runBackgroundScan, 10_000); // first scan 10s after start
  }

  const port = Number(process.env.PORT) || 3000;
  server.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`);
  });
});
