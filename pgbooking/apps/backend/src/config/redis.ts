import Redis, { RedisOptions } from 'ioredis';
import { env } from './environment';
import { logger } from '@shared/utils/logger';

const REDIS_RETRY_STRATEGY = (times: number): number | null => {
  if (times > 10) {
    logger.error('Redis: Maximum reconnection attempts exceeded. Giving up.');
    return null;
  }
  const delay = Math.min(times * 100, 3000);
  logger.warn(`Redis: Reconnecting in ${delay}ms (attempt ${times})`);
  return delay;
};

function buildRedisOptions(db: number): RedisOptions {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const url = new (global as any).URL(env.REDIS_URL) as { hostname: string; port: string; password: string };
  return {
    host: url.hostname,
    port: parseInt(url.port || '6379', 10),
    password: env.REDIS_PASSWORD || url.password || undefined,
    db,
    keyPrefix: env.REDIS_KEY_PREFIX,
    retryStrategy: REDIS_RETRY_STRATEGY,
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    enableReadyCheck: true,
    connectTimeout: 10000,
    commandTimeout: 5000,
    family: 4,
    keepAlive: 30000,
  };
}

// ─────────────────────────────────────────────
// Redis Instances (separate logical databases)
// ─────────────────────────────────────────────

let cacheClient: Redis | null = null;
let sessionClient: Redis | null = null;
let lockClient: Redis | null = null;
let queueClient: Redis | null = null;

function createRedisClient(db: number, name: string): Redis {
  const client = new Redis(buildRedisOptions(db));

  client.on('connect', () => {
    logger.info(`Redis [${name}] connected`, { db });
  });

  client.on('ready', () => {
    logger.info(`Redis [${name}] ready`);
  });

  client.on('error', (err: Error) => {
    logger.error(`Redis [${name}] error`, { error: err.message, db });
  });

  client.on('close', () => {
    logger.warn(`Redis [${name}] connection closed`);
  });

  client.on('reconnecting', (delay: number) => {
    logger.warn(`Redis [${name}] reconnecting`, { delay });
  });

  return client;
}

export function getCacheClient(): Redis {
  if (!cacheClient) {
    cacheClient = createRedisClient(env.REDIS_CACHE_DB, 'cache');
  }
  return cacheClient;
}

export function getSessionClient(): Redis {
  if (!sessionClient) {
    sessionClient = createRedisClient(env.REDIS_SESSION_DB, 'session');
  }
  return sessionClient;
}

export function getLockClient(): Redis {
  if (!lockClient) {
    lockClient = createRedisClient(env.REDIS_LOCK_DB, 'lock');
  }
  return lockClient;
}

export function getQueueClient(): Redis {
  if (!queueClient) {
    queueClient = createRedisClient(env.REDIS_QUEUE_DB, 'queue');
  }
  return queueClient;
}

// ─────────────────────────────────────────────
// Connect All Redis Instances
// ─────────────────────────────────────────────

export async function connectRedis(): Promise<void> {
  const clients = [
    { client: getCacheClient(), name: 'cache' },
    { client: getSessionClient(), name: 'session' },
    { client: getLockClient(), name: 'lock' },
    { client: getQueueClient(), name: 'queue' },
  ];

  await Promise.all(
    clients.map(async ({ client, name }) => {
      try {
        await client.connect();
        await client.ping();
        logger.info(`✅ Redis [${name}] connected`);
      } catch (error) {
        const err = error as Error;
        throw new Error(`Failed to connect Redis [${name}]: ${err.message}`);
      }
    }),
  );
}

export async function disconnectRedis(): Promise<void> {
  const clients = [cacheClient, sessionClient, lockClient, queueClient].filter(Boolean);
  await Promise.all(clients.map((c) => c!.quit()));
  cacheClient = sessionClient = lockClient = queueClient = null;
  logger.info('All Redis connections closed');
}

// ─────────────────────────────────────────────
// Health Check
// ─────────────────────────────────────────────

export async function checkRedisHealth(): Promise<{
  healthy: boolean;
  latencyMs: number;
}> {
  const start = Date.now();
  try {
    await getCacheClient().ping();
    return { healthy: true, latencyMs: Date.now() - start };
  } catch {
    return { healthy: false, latencyMs: Date.now() - start };
  }
}

// ─────────────────────────────────────────────
// Cache Utilities
// ─────────────────────────────────────────────

export class CacheService {
  private client: Redis;
  private defaultTTL: number;

  constructor(client: Redis, defaultTTLSeconds = 300) {
    this.client = client;
    this.defaultTTL = defaultTTLSeconds;
  }

  async get<T>(key: string): Promise<T | null> {
    const value = await this.client.get(key);
    if (!value) return null;
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const ttl = ttlSeconds ?? this.defaultTTL;
    await this.client.setex(key, ttl, JSON.stringify(value));
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async delPattern(pattern: string): Promise<void> {
    const keys = await this.client.keys(pattern);
    if (keys.length > 0) {
      await this.client.del(...keys);
    }
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result === 1;
  }

  async ttl(key: string): Promise<number> {
    return this.client.ttl(key);
  }

  async increment(key: string, by = 1): Promise<number> {
    return this.client.incrby(key, by);
  }

  async setNX(key: string, value: string, ttlMs: number): Promise<boolean> {
    const result = await this.client.set(key, value, 'PX', ttlMs, 'NX');
    return result === 'OK';
  }
}
