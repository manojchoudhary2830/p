import { getLockClient } from '@config/redis';
import { env } from '@config/environment';
import { logger } from '@shared/utils/logger';
import { BedAlreadyReservedError } from '@shared/errors';

const LOCK_PREFIX = 'lock:bed:';

// ─────────────────────────────────────────────
// Distributed Lock (Redis SET NX PX)
// Implements the pattern from TRD Section 3
// ─────────────────────────────────────────────

export function buildLockKey(bedId: string): string {
  return `${LOCK_PREFIX}${bedId}`;
}

/**
 * Attempts to acquire a distributed lock on a bed.
 * Uses SET key value NX PX ttl — atomic, no race condition.
 * Returns the lock token (used to safely release).
 * Throws BedAlreadyReservedError if lock is held.
 */
export async function acquireBedLock(
  bedId: string,
  sessionId: string,
  ttlMs = env.BOOKING_LOCK_TTL_MS,
): Promise<{ lockKey: string; acquired: boolean }> {
  const lockKey = buildLockKey(bedId);
  const client = getLockClient();

  let acquired = false;
  let lastError: Error | null = null;

  // Retry with exponential backoff
  for (let attempt = 0; attempt < env.BOOKING_LOCK_RETRY_COUNT; attempt++) {
    try {
      const result = await client.set(lockKey, sessionId, 'PX', ttlMs, 'NX');
      acquired = result === 'OK';

      if (acquired) {
        logger.debug('Bed lock acquired', { bedId, sessionId, ttlMs });
        return { lockKey, acquired: true };
      }

      if (attempt < env.BOOKING_LOCK_RETRY_COUNT - 1) {
        const delay = env.BOOKING_LOCK_RETRY_DELAY_MS * Math.pow(2, attempt);
        await new Promise((r) => setTimeout(r, delay));
      }
    } catch (err) {
      lastError = err as Error;
      logger.error('Redis lock acquire error', { error: (err as Error).message, bedId });
    }
  }

  if (lastError) throw lastError;
  throw new BedAlreadyReservedError(bedId);
}

/**
 * Releases a lock ONLY if the caller owns it (compare-and-delete Lua script).
 * Prevents a process from deleting another process's lock.
 */
export async function releaseBedLock(lockKey: string, sessionId: string): Promise<boolean> {
  const client = getLockClient();

  // Lua script: atomic compare-and-delete
  const luaScript = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    else
      return 0
    end
  `;

  try {
    const result = await client.eval(luaScript, 1, lockKey, sessionId) as number;
    const released = result === 1;
    logger.debug('Bed lock release', { lockKey, released });
    return released;
  } catch (err) {
    logger.error('Redis lock release error', { error: (err as Error).message, lockKey });
    return false;
  }
}

/**
 * Force-releases a lock regardless of owner (for admin/cleanup).
 */
export async function forceReleaseBedLock(lockKey: string): Promise<void> {
  await getLockClient().del(lockKey);
  logger.info('Bed lock force-released', { lockKey });
}

/**
 * Returns remaining TTL of a lock in milliseconds, or -1 if not held.
 */
export async function getLockTtlMs(lockKey: string): Promise<number> {
  const ttl = await getLockClient().pttl(lockKey);
  return ttl < 0 ? -1 : ttl;
}

export async function isBedLocked(bedId: string): Promise<boolean> {
  const ttl = await getLockTtlMs(buildLockKey(bedId));
  return ttl > 0;
}
