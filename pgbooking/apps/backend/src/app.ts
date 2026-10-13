import 'express-async-errors';
import express, { Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { v4 as uuidv4 } from 'uuid';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { setSocketIO } from '@infrastructure/socket/socket.server';

import { env } from '@config/environment';
import { morganStream } from '@shared/utils/logger';
import { globalRateLimit } from '@shared/middleware/rate-limit.middleware';
import { errorHandler, notFoundHandler } from '@shared/middleware/error.middleware';

// Domain routes
import { authRouter } from '@domains/auth/routes/auth.routes';
import { userRouter } from '@domains/users/routes/user.routes';
import { propertyRouter } from '@domains/properties/routes/property.routes';
import { roomRouter } from '@domains/rooms/routes/room.routes';
import { bedRouter } from '@domains/beds/routes/bed.routes';
import { searchRouter } from '@domains/search/routes/search.routes';
import { bookingRouter } from '@domains/bookings/routes/booking.routes';
import { paymentRouter } from '@domains/payments/routes/payment.routes';
import { maintenanceRouter } from '@domains/maintenance/routes/maintenance.routes';
import { notificationRouter } from '@domains/notifications/routes/notification.routes';
import { ownerRouter } from '@domains/owner/routes/owner.routes';
import { adminRouter } from '@domains/admin/routes/admin.routes';

// ─────────────────────────────────────────────
// Socket.IO setup
// ─────────────────────────────────────────────

export function createSocketServer(app: Application): {
  httpServer: ReturnType<typeof createServer>;
  io: SocketIOServer;
} {
  const httpServer = createServer(app);
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: env.SOCKET_CORS_ORIGINS,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: env.SOCKET_PING_TIMEOUT,
    pingInterval: env.SOCKET_PING_INTERVAL,
    transports: ['websocket', 'polling'],
  });

  // Attach io instance to app for use in controllers
  app.set('io', io);

  io.on('connection', (socket: any) => {
    const { userId } = socket.handshake.auth as { userId?: string };
    if (userId) {
      socket.join(`user:${userId}`);
    }
    socket.on('join:booking', (bookingId: string) => {
      socket.join(`booking:${bookingId}`);
    });
    socket.on('disconnect', () => {});
  });

  setSocketIO(io);
  return { httpServer, io };
}

// ─────────────────────────────────────────────
// Application Factory
// ─────────────────────────────────────────────

export function createApp(): Application {
  const app = express();

  // ── Trust proxy (for nginx / load balancer) ──
  app.set('trust proxy', 1);

  // ── Security headers ──
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'"],
          frameSrc: ["'none'"],
          objectSrc: ["'none'"],
        },
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
      crossOriginEmbedderPolicy: false,
    }),
  );

  // ── CORS ──
  app.use(
    cors({
      origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
        if (!origin) {
          // Allow server-to-server / curl requests in dev
          callback(null, true);
          return;
        }
        if (env.CORS_ORIGINS.includes(origin) || env.NODE_ENV === 'development') {
          callback(null, true);
        } else {
          callback(new Error(`CORS: origin '${origin}' not allowed`));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Request-ID',
        'X-Idempotency-Key',
      ],
      exposedHeaders: [
        'X-Request-ID',
        'X-RateLimit-Limit',
        'X-RateLimit-Remaining',
        'X-RateLimit-Reset',
      ],
    }),
  );

  // ── Body parsing ──
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cookieParser());
  app.use(compression());

  // ── Request ID injection ──
  app.use((req: any, _res: any, next: any) => {
    req.requestId = (req.headers['x-request-id'] as string) ?? uuidv4();
    req.startTime = Date.now();
    next();
  });

  // ── HTTP request logging ──
  app.use(
    morgan(':method :url :status :res[content-length] - :response-time ms', {
      stream: morganStream,
      skip: (req: any) => req.path === '/health',
    }),
  );

  // ── Global rate limiting ──
  app.use(globalRateLimit);

  // ─────────────────────────────────────────────
  // Health Check
  // ─────────────────────────────────────────────
  app.get('/health', async (_req: any, res: any) => {
    const start = Date.now();
    const { checkDatabaseHealth } = await import('@config/database');
    const { checkRedisHealth }    = await import('@config/redis');
    const [db, cache] = await Promise.allSettled([
      checkDatabaseHealth(),
      checkRedisHealth(),
    ]);

    const dbResult    = db.status    === 'fulfilled' ? db.value    : { healthy: false, error: (db    as PromiseRejectedResult).reason?.message };
    const cacheResult = cache.status === 'fulfilled' ? cache.value : { healthy: false, error: (cache as PromiseRejectedResult).reason?.message };

    const healthy = dbResult.healthy && cacheResult.healthy;
    const memMb   = Math.round((process as any).memoryUsage().heapUsed / 1024 / 1024);

    res.status(healthy ? 200 : 503).json({
      status:    healthy ? 'healthy' : 'degraded',
      version:   env.APP_VERSION,
      env:       env.NODE_ENV,
      uptime_s:  Math.floor((process as any).uptime()),
      latency_ms: Date.now() - start,
      memory_mb: memMb,
      timestamp: new Date().toISOString(),
      services: {
        database: dbResult,
        cache:    cacheResult,
      },
    });
  });

  // ─────────────────────────────────────────────
  // API Routes
  // ─────────────────────────────────────────────
  const API = env.API_PREFIX;

  app.use(`${API}/auth`, authRouter);
  app.use(`${API}/users`, userRouter);
  app.use(`${API}/properties`, propertyRouter);
  // Rooms are sub-resources of properties: /properties/:propertyId/rooms
  app.use(`${API}/properties`, roomRouter);
  // Beds are sub-resources of rooms: /rooms/:roomId/beds
  app.use(`${API}/rooms/:roomId/beds`, bedRouter);
  app.use(`${API}/search`, searchRouter);
  app.use(`${API}/bookings`, bookingRouter);
  app.use(`${API}/payments`, paymentRouter);
  app.use(`${API}/maintenance`, maintenanceRouter);
  app.use(`${API}/notifications`, notificationRouter);
  app.use(`${API}/owner`, ownerRouter);
  app.use(`${API}/admin`, adminRouter);

  // ─────────────────────────────────────────────
  // Error Handling (must be last)
  // ─────────────────────────────────────────────
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
