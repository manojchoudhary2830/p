import * as fs from 'fs';
import * as path from 'path';
import { connectDatabase, query, disconnectDatabase } from '@config/database';
import { logger } from '@shared/utils/logger';
import { env } from '@config/environment';

const MIGRATIONS_DIR = path.resolve(__dirname, '../../../../../../database/migrations');
const SEEDS_DIR = path.resolve(__dirname, '../../../../../../database/seeds');

const TABLES_IN_DEPENDENCY_ORDER = [
  'audit_logs', 'reviews', 'favorites', 'notifications',
  'maintenance_comments', 'maintenance_tickets', 'payments', 'bookings',
  'beds', 'rooms', 'property_photos', 'properties',
  'kyc_documents', 'refresh_tokens', 'otp_logs', 'users',
];

async function resetDatabase(): Promise<void> {
  if (env.NODE_ENV === 'production') {
    throw new Error('Refusing to reset a production database.');
  }

  await connectDatabase();
  logger.warn('⚠️  Resetting database — all data will be lost');

  // Truncate all tables (faster than DROP/recreate, preserves schema + triggers)
  for (const table of TABLES_IN_DEPENDENCY_ORDER) {
    try {
      await query(`TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE`);
      logger.info(`Truncated: ${table}`);
    } catch (error) {
      logger.warn(`Could not truncate ${table} (may not exist yet)`, {
        error: (error as Error).message,
      });
    }
  }

  // Re-apply seed data
  const seedFiles = fs.readdirSync(SEEDS_DIR).filter((f) => f.endsWith('.sql')).sort();
  for (const file of seedFiles) {
    const sql = ((fs.readFileSync(path.join(SEEDS_DIR, file), 'utf8') as string) as string);
    await query(sql);
    logger.info(`Re-seeded: ${file}`);
  }

  logger.info('✅ Database reset complete');
}

resetDatabase()
  .then(async () => {
    await disconnectDatabase();
    process.exit(0);
  })
  .catch(async (error: Error) => {
    logger.error('Reset failed', { error: error.message });
    await disconnectDatabase().catch(() => {});
    process.exit(1);
  });
