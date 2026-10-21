import { createServer } from 'node:http';
import next from 'next';
import { Server } from 'socket.io';
import { appOrigin, jwtKey } from './src/server/config.ts';
import { readSessionCookie, verifyToken } from './src/server/auth.ts';
import { eventBus } from './src/server/events.ts';
import { closePool } from './src/server/db.ts';
import type { InventoryEvent, ServerEvents, Session } from './src/shared/types.ts';

const dev = process.env.NODE_ENV !== 'production';
const port = Number(process.env.PORT || 3000);
const hostname = process.env.HOST || '0.0.0.0';
const application = next({ dev, hostname, port });
await application.prepare();
jwtKey();
const origin = appOrigin();
const handler = application.getRequestHandler();

const httpServer = createServer((request, response) => {
  if (request.headers.host !== new URL(origin).host) {
    response.writeHead(421).end();
    return;
  }
  request.headers['x-inventory-client-ip'] = request.socket.remoteAddress || 'unknown';
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (origin.startsWith('https:'))
    response.setHeader('Strict-Transport-Security', 'max-age=31536000');
  void handler(request, response);
});

const io = new Server<
  Record<string, never>,
  ServerEvents,
  Record<string, never>,
  { session: Session }
>(httpServer, {
  transports: ['websocket'],
  maxHttpBufferSize: 16_384,
  allowRequest: (request, done) => done(null, request.headers.origin === origin),
});

io.use(async (socket, done) => {
  const session = await verifyToken(readSessionCookie(socket.request.headers.cookie));
  if (!session) {
    done(new Error('auth_required'));
    return;
  }
  socket.data.session = session;
  done();
});

function broadcastCount() {
  io.emit('sessions:count', io.sockets.sockets.size);
}

io.on('connection', (socket) => {
  broadcastCount();
  const expiresAt = Number(socket.data.session.expiresAt);
  const timeout = setTimeout(
    () => {
      socket.emit('session:expired');
      socket.disconnect(true);
    },
    Math.max(0, expiresAt - Date.now()),
  );
  socket.on('disconnect', () => {
    clearTimeout(timeout);
    broadcastCount();
  });
});

const onChange = (event: InventoryEvent) => io.emit('inventory:changed', event);
eventBus().on('inventory:changed', onChange);

httpServer.listen(port, hostname, () => console.info(`[server] listening on port ${port}`));

let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  eventBus().off('inventory:changed', onChange);
  await new Promise<void>((resolve) => io.close(() => resolve()));
  await closePool();
  await application.close();
  process.exit(0);
}
process.once('SIGINT', () => {
  void stop();
});
process.once('SIGTERM', () => {
  void stop();
});
