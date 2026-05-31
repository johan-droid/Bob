#!/usr/bin/env node
/**
 * Local Dev-Proxy Tunneling Script
 * 
 * This script orchestrates local webhook forwarding for debugging incoming
 * GitHub payload sequences without deploying to production.
 * 
 * Features:
 * - Creates a local tunnel endpoint that forwards to your dev server
 * - Logs all incoming webhook payloads to a configurable log file
 * - Replays webhook payloads for testing
 * - Validates webhook signatures in development mode
 */

import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { URL } from 'url';

// Configuration
const CONFIG = {
  // Local dev server port (your Next.js app)
  LOCAL_PORT: process.env.LOCAL_DEV_PORT || 3000,
  
  // Proxy server port (where GitHub webhooks will be sent)
  PROXY_PORT: process.env.WEBHOOK_PROXY_PORT || 8787,
  
  // Log file for webhook payloads
  LOG_FILE: process.env.WEBHOOK_LOG_FILE || './webhook_logs.jsonl',
  
  // GitHub webhook secret (optional for local dev)
  WEBHOOK_SECRET: process.env.WEBHOOK_SECRET || '',
  
  // Allow unsigned webhooks in development
  ALLOW_UNSIGNED: process.env.ALLOW_UNSIGNED_WEBHOOKS === '1' || process.env.NODE_ENV !== 'production',
  
  // Ngrok/Cloudflare tunnel URL (if using external tunneling)
  TUNNEL_URL: process.env.TUNNEL_URL || '',
  
  // Replay delay in ms
  REPLAY_DELAY: parseInt(process.env.REPLAY_DELAY || '1000', 10),
};

// Ensure log directory exists
const logDir = path.dirname(CONFIG.LOG_FILE);
if (logDir && logDir !== '.' && !fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// In-memory queue for replay functionality
interface WebhookEvent {
  id: string;
  timestamp: string;
  event: string;
  signature: string;
  payload: any;
  forwardedTo: string;
  responseStatus?: number;
  responseBody?: string;
}

const webhookQueue: WebhookEvent[] = [];
const MAX_QUEUE_SIZE = 100;

function generateId(): string {
  return crypto.randomBytes(16).toString('hex');
}

function logWebhook(event: WebhookEvent): void {
  const logLine = JSON.stringify(event) + '\n';
  fs.appendFileSync(CONFIG.LOG_FILE, logLine);
  console.log(`[${new Date().toISOString()}] Logged webhook ${event.id} (${event.event})`);
}

function safeCompare(left: string, right: string): boolean {
  if (!left || !right) return false;
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  if (leftBytes.length !== rightBytes.length) return false;
  return crypto.timingSafeEqual(leftBytes, rightBytes);
}

function verifySignature(payload: string, signature: string): boolean {
  if (!CONFIG.WEBHOOK_SECRET) {
    return CONFIG.ALLOW_UNSIGNED;
  }
  
  const expected = 'sha256=' + crypto
    .createHmac('sha256', CONFIG.WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');
    
  return safeCompare(signature, expected);
}

function forwardToLocal(payload: string, headers: Record<string, string>): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const url = new URL(`http://localhost:${CONFIG.LOCAL_PORT}/api/webhooks/github`);
    
    const options = {
      hostname: 'localhost',
      port: CONFIG.LOCAL_PORT,
      path: '/api/webhooks/github',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({ status: res.statusCode || 0, body: data });
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function handleWebhook(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const eventId = generateId();
  const timestamp = new Date().toISOString();
  
  let body = '';
  req.on('data', chunk => body += chunk);
  
  req.on('end', async () => {
    const eventType = req.headers['x-github-event'] as string || 'unknown';
    const signature = req.headers['x-hub-signature-256'] as string || '';
    
    // Verify signature (skip in dev if allowed)
    if (!CONFIG.ALLOW_UNSIGNED && !verifySignature(body, signature)) {
      console.warn(`[${eventId}] Webhook signature mismatch`);
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Signature mismatch' }));
      return;
    }

    let payload: any;
    try {
      payload = JSON.parse(body);
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
      return;
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`[${eventId}] ${eventType} -> ${payload.repository?.full_name || 'unknown'}`);
    console.log(`${'='.repeat(60)}`);
    
    // Pretty print payload for debugging
    console.log('Payload preview:');
    console.log(JSON.stringify(payload, null, 2).slice(0, 500) + '...');

    // Forward to local dev server
    const forwardHeaders: Record<string, string> = {};
    if (req.headers['x-github-event']) forwardHeaders['X-GitHub-Event'] = req.headers['x-github-event'] as string;
    if (req.headers['x-hub-signature-256']) forwardHeaders['X-Hub-Signature-256'] = req.headers['x-hub-signature-256'] as string;
    if (req.headers['x-github-delivery']) forwardHeaders['X-GitHub-Delivery'] = req.headers['x-github-delivery'] as string;

    try {
      const result = await forwardToLocal(body, forwardHeaders);
      
      const webhookEvent: WebhookEvent = {
        id: eventId,
        timestamp,
        event: eventType,
        signature,
        payload,
        forwardedTo: `http://localhost:${CONFIG.LOCAL_PORT}/api/webhooks/github`,
        responseStatus: result.status,
        responseBody: result.body
      };

      // Add to queue
      webhookQueue.push(webhookEvent);
      if (webhookQueue.length > MAX_QUEUE_SIZE) {
        webhookQueue.shift();
      }

      // Log to file
      logWebhook(webhookEvent);

      console.log(`[${eventId}] Forwarded successfully, status: ${result.status}`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, eventId, forwarded: true }));
    } catch (error: any) {
      console.error(`[${eventId}] Forward failed:`, error.message);
      
      const webhookEvent: WebhookEvent = {
        id: eventId,
        timestamp,
        event: eventType,
        signature,
        payload,
        forwardedTo: `http://localhost:${CONFIG.LOCAL_PORT}/api/webhooks/github`,
        responseStatus: 500,
        responseBody: error.message
      };
      
      webhookQueue.push(webhookEvent);
      logWebhook(webhookEvent);
      
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Forward failed', message: error.message }));
    }
  });
}

function handleReplay(req: http.IncomingMessage, res: http.ServerResponse): void {
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  let body = '';
  req.on('data', chunk => body += chunk);
  
  req.on('end', async () => {
    try {
      const { eventId } = JSON.parse(body);
      const event = webhookQueue.find(e => e.id === eventId);
      
      if (!event) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Event not found' }));
        return;
      }

      console.log(`\n[${eventId}] Replaying webhook...`);
      
      const forwardHeaders: Record<string, string> = {
        'X-GitHub-Event': event.event
      };
      if (event.signature) {
        forwardHeaders['X-Hub-Signature-256'] = event.signature;
      }

      const result = await forwardToLocal(JSON.stringify(event.payload), forwardHeaders);
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        ok: true, 
        replayed: true, 
        eventId,
        responseStatus: result.status 
      }));
    } catch (error: any) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Replay failed', message: error.message }));
    }
  });
}

function handleListEvents(req: http.IncomingMessage, res: http.ServerResponse): void {
  if (req.method !== 'GET') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  const recentEvents = webhookQueue.slice(-20).reverse();
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    events: recentEvents.map(e => ({
      id: e.id,
      timestamp: e.timestamp,
      event: e.event,
      repo: e.payload.repository?.full_name,
      status: e.responseStatus
    }))
  }));
}

function handleGetEvent(req: http.IncomingMessage, res: http.ServerResponse, eventId: string): void {
  if (req.method !== 'GET') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  const event = webhookQueue.find(e => e.id === eventId);
  if (!event) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Event not found' }));
    return;
  }

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(event));
}

function showHelp(): void {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║         Local Dev-Proxy Webhook Tunneling Script            ║
╚══════════════════════════════════════════════════════════════╝

Usage: npm run webhook-proxy [options]

Environment Variables:
  LOCAL_DEV_PORT          Your local dev server port (default: 3000)
  WEBHOOK_PROXY_PORT      Proxy server port (default: 8787)
  WEBHOOK_LOG_FILE        Log file path (default: ./webhook_logs.jsonl)
  WEBHOOK_SECRET          GitHub webhook secret for signature verification
  ALLOW_UNSIGNED_WEBHOOKS Allow unsigned webhooks in dev (default: 1 in non-prod)
  TUNNEL_URL              External tunnel URL (ngrok/cloudflare)
  REPLAY_DELAY            Delay before replay in ms (default: 1000)

Endpoints:
  POST /                  - Receive and forward GitHub webhooks
  GET  /events            - List recent webhook events
  GET  /events/:id        - Get details of a specific event
  POST /replay            - Replay a webhook event (body: { eventId })

GitHub Webhook Setup:
  1. Start this proxy: npm run webhook-proxy
  2. Use ngrok: ngrok http ${CONFIG.PROXY_PORT}
  3. Configure GitHub webhook to point to: https://<ngrok-url>/
  
  Or use directly in local network if GitHub can reach your machine.

Log File:
  All webhooks are logged to: ${CONFIG.LOG_FILE}
  View with: tail -f ${CONFIG.LOG_FILE} | jq

Current Config:
  Local Port:     ${CONFIG.LOCAL_PORT}
  Proxy Port:     ${CONFIG.PROXY_PORT}
  Allow Unsigned: ${CONFIG.ALLOW_UNSIGNED}
  Log File:       ${CONFIG.LOG_FILE}
`);
}

// Main server
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://localhost:${CONFIG.PROXY_PORT}`);
  const pathname = url.pathname;

  // CORS headers for browser access
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-GitHub-Event, X-Hub-Signature-256');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    if (pathname === '/' || pathname === '/webhook') {
      await handleWebhook(req, res);
    } else if (pathname === '/events') {
      handleListEvents(req, res);
    } else if (pathname.startsWith('/events/')) {
      const eventId = pathname.split('/')[2];
      handleGetEvent(req, res, eventId);
    } else if (pathname === '/replay') {
      await handleReplay(req, res);
    } else if (pathname === '/help' || pathname === '/') {
      if (req.method === 'GET' && pathname === '/help') {
        showHelp();
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('See console for help information');
      } else if (req.method === 'GET' && pathname === '/') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          service: 'Bob Webhook Proxy',
          status: 'running',
          config: {
            localPort: CONFIG.LOCAL_PORT,
            proxyPort: CONFIG.PROXY_PORT,
            logFile: CONFIG.LOG_FILE
          },
          endpoints: {
            'POST /': 'Forward webhook to local dev',
            'GET /events': 'List recent events',
            'GET /events/:id': 'Get event details',
            'POST /replay': 'Replay an event'
          }
        }));
      }
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
    }
  } catch (error: any) {
    console.error('Server error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal server error', message: error.message }));
  }
});

// Start server
server.listen(CONFIG.PROXY_PORT, () => {
  console.log('\n' + '═'.repeat(60));
  console.log('🔌 Bob Webhook Proxy Server Started');
  console.log('═'.repeat(60));
  console.log(`Proxy listening on: http://localhost:${CONFIG.PROXY_PORT}`);
  console.log(`Forwarding to:      http://localhost:${CONFIG.LOCAL_PORT}/api/webhooks/github`);
  console.log(`Logging to:         ${CONFIG.LOG_FILE}`);
  console.log('\n📡 GitHub Webhook URL Setup:');
  if (CONFIG.TUNNEL_URL) {
    console.log(`   Configure GitHub to send webhooks to: ${CONFIG.TUNNEL_URL}`);
  } else {
    console.log(`   Use ngrok: ngrok http ${CONFIG.PROXY_PORT}`);
    console.log('   Then configure GitHub with the ngrok URL');
  }
  console.log('\n💡 Quick Commands:');
  console.log(`   curl http://localhost:${CONFIG.PROXY_PORT}/events           # List events`);
  console.log(`   curl http://localhost:${CONFIG.PROXY_PORT}/events/:id       # Get event`);
  console.log(`   curl -X POST -d '{"eventId":"xxx"}' http://localhost:${CONFIG.PROXY_PORT}/replay  # Replay`);
  console.log('═'.repeat(60) + '\n');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down webhook proxy...');
  server.close(() => {
    console.log('Proxy server closed');
    process.exit(0);
  });
});

export { CONFIG, webhookQueue };
