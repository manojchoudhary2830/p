import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { env } from './environment';
import { logger } from '@shared/utils/logger';

let pool: Pool | null = null;

export function createDatabasePool(): Pool {
  const instance = new Pool({
    connectionString: env.DATABASE_URL,
    min: env.DB_POOL_MIN,
    max: env.DB_POOL_MAX,
    idleTimeoutMillis: env.DB_IDLE_TIMEOUT_MS,
    connectionTimeoutMillis: env.DB_CONNECTION_TIMEOUT_MS,
    ssl: env.DB_SSL ? { rejectUnauthorized: true } : false,
    application_name: `${env.APP_NAME}-${env.NODE_ENV}`,
  });

  instance.on('connect', (client: PoolClient) => {
    logger.debug('Database client connected');
    // Enforce UTC timezone for all connections
    client.query("SET TIME ZONE 'UTC'").catch((err: Error) => {
      logger.error('Failed to set timezone on DB client', { error: err.message });
    });
  });

  instance.on('error', (err: Error) => {
    logger.error('Unexpected error on idle PostgreSQL client', {
      error: err.message,
      stack: err.stack,
    });
  });

  instance.on('remove', () => {
    logger.debug('Database client removed from pool');
  });

  return instance;
}

export function getPool(): Pool {
  if (!pool) {
    pool = createDatabasePool();
  }
  return pool;
}

export async function connectDatabase(): Promise<void> {
  const db = getPool();
  let attempts = 0;
  const maxAttempts = 10;
  const retryDelayMs = 2000;

  while (attempts < maxAttempts) {
    try {
      const client = await db.connect();

      // Verify PostGIS extension is available
      await client.query('SELECT PostGIS_Version()');

      client.release();
      logger.info('✅ Database connected successfully', {
        host: new URL(env.DATABASE_URL).hostname,
        database: new URL(env.DATABASE_URL).pathname.slice(1),
        poolMin: env.DB_POOL_MIN,
        poolMax: env.DB_POOL_MAX,
      });
      return;
    } catch (error) {
      attempts++;
      const err = error as Error;
      logger.warn(
        `Database connection attempt ${attempts}/${maxAttempts} failed: ${err.message}`,
      );

      if (attempts >= maxAttempts) {
        throw new Error(
          `Failed to connect to database after ${maxAttempts} attempts: ${err.message}`,
        );
      }

      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }
}

export async function disconnectDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    logger.info('Database pool closed');
  }
}

// ─────────────────────────────────────────────
// Query Helpers
// ─────────────────────────────────────────────

export async function query<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params?: unknown[],
): Promise<QueryResult<T>> {
  const start = Date.now();
  try {
    const result = await getPool().query<T>(sql, params);
    const duration = Date.now() - start;

    if (duration > 1000) {
      logger.warn('Slow query detected', { sql: sql.substring(0, 200), duration, rows: result.rowCount });
    }

    return result;
  } catch (error) {
    const err = error as Error;
    logger.error('Database query error', {
      sql: sql.substring(0, 200),
      error: err.message,
      duration: Date.now() - start,
    });
    throw error;
  }
}

export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params?: unknown[],
): Promise<T | null> {
  const result = await query<T>(sql, params);
  return result.rows[0] ?? null;
}

export async function queryMany<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params?: unknown[],
): Promise<T[]> {
  const result = await query<T>(sql, params);
  return result.rows;
}

// ─────────────────────────────────────────────
// Transaction Helper
// ─────────────────────────────────────────────

export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// ─────────────────────────────────────────────
// Health Check
// ─────────────────────────────────────────────

export async function checkDatabaseHealth(): Promise<{
  healthy: boolean;
  latencyMs: number;
  poolSize: number;
  idleConnections: number;
  waitingClients: number;
}> {
  const start = Date.now();
  try {
    await query('SELECT 1');
    const db = getPool();
    return {
      healthy: true,
      latencyMs: Date.now() - start,
      poolSize: db.totalCount,
      idleConnections: db.idleCount,
      waitingClients: db.waitingCount,
    };
  } catch {
    return {
      healthy: false,
      latencyMs: Date.now() - start,
      poolSize: 0,
      idleConnections: 0,
      waitingClients: 0,
    };
  }
}
