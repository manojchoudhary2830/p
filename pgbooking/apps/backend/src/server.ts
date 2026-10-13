// MUST be the first import — registers @config, @shared, @domains, @infrastructure path aliases
// using the _moduleAliases map in package.json so dist/ can resolve them at runtime.
import 'module-alias/register';

import { createApp, createSocketServer } from './app';
import { connectDatabase, disconnectDatabase } from '@config/database';
import { connectRedis, disconnectRedis } from '@config/redis';
import { closeAllQueues } from '@infrastructure/queue/bullmq.client';
import { logger } from '@shared/utils/logger';
import { env } from '@config/environment';

// ─────────────────────────────────────────────
// Bootstrap
// ─────────────────────────────────────────────

async function bootstrap(): Promise<void> {
  logger.info(`Starting ${env.APP_NAME} v${env.APP_VERSION} [${env.NODE_ENV}]`);

  // ── Pre-flight: validate JWT key files exist ─────────────────────
  // Fail fast with a clear message rather than crashing on the first
  // authenticated request with an opaque "no such file" error.
  if (env.NODE_ENV !== 'test') {
    const fs = await import('fs');
    const missingKeys: string[] = [];
    if (!fs.existsSync(env.JWT_PRIVATE_KEY_PATH)) missingKeys.push(`private key: ${env.JWT_PRIVATE_KEY_PATH}`);
    if (!fs.existsSync(env.JWT_PUBLIC_KEY_PATH))  missingKeys.push(`public key:  ${env.JWT_PUBLIC_KEY_PATH}`);
    if (missingKeys.length > 0) {
      logger.error('❌ JWT key files not found. Run: npm run keys:generate');
      missingKeys.forEach(k => logger.error(`   Missing: ${k}`));
      process.exit(1);
    }
    logger.info('✅ JWT keys verified');
  }

  // Connect infrastructure
  await connectDatabase();
  await connectRedis();

  // Start background workers (lazy import to avoid circular deps)
  if (env.NODE_ENV !== 'test') {
    const { startWorkers } = await import('@infrastructure/queue/workers');
    await startWorkers();
  }

  // Create Express app and Socket.IO server
  const app = createApp();
  const { httpServer } = createSocketServer(app);

  // Listen
  httpServer.listen(env.PORT, () => {
    logger.info(`✅ Server listening on port ${env.PORT}`, {
      port: env.PORT,
      env: env.NODE_ENV,
      pid: process.pid,
    });
  });

  // ── Graceful Shutdown ──────────────────────
  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`${signal} received — initiating graceful shutdown`);

    // Stop accepting new connections
    httpServer.close(async () => {
      logger.info('HTTP server closed');
    });

    try {
      await closeAllQueues();
      await disconnectRedis();
      await disconnectDatabase();
      logger.info('✅ Graceful shutdown complete');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown', { error: (error as Error).message });
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));

  // ── Catch unhandled errors that escape the Express error middleware ──
  process.on('uncaughtException', (error: Error) => {
    logger.error('UNCAUGHT EXCEPTION — shutting down', {
      error: error.message,
      stack: error.stack,
    });
    shutdown('uncaughtException').catch(() => process.exit(1));
  });

  process.on('unhandledRejection', (reason: unknown) => {
    logger.error('UNHANDLED REJECTION — shutting down', {
      reason: reason instanceof Error ? reason.message : String(reason),
    });
    shutdown('unhandledRejection').catch(() => process.exit(1));
  });
}

bootstrap().catch((error: Error) => {
  logger.error('Fatal: Failed to start server', {
    error: error.message,
    stack: error.stack,
  });
  process.exit(1);
});
