import * as fs from 'fs';
import * as path from 'path';
import { connectDatabase, query, disconnectDatabase } from '@config/database';
import { logger } from '@shared/utils/logger';
import { env } from '@config/environment';

const SEEDS_DIR = path.resolve(__dirname, '../../../../../../database/seeds');

async function runSeeds(): Promise<void> {
  if (env.NODE_ENV === 'production') {
    throw new Error('Refusing to run seed data against a production environment.');
  }

  await connectDatabase();
  logger.info('Connected to database for seeding');

  const files = fs
    .readdirSync(SEEDS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    logger.warn(`No seed files found in ${SEEDS_DIR}`);
    return;
  }

  for (const file of files) {
    const filePath = path.join(SEEDS_DIR, file);
    const sql = fs.readFileSync(filePath, 'utf8') as string;

    logger.info(`Applying seed file: ${file}`);
    try {
      await query(sql);
      logger.info(`✅ Seed applied: ${file}`);
    } catch (error) {
      logger.error(`❌ Failed to apply seed: ${file}`, {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  logger.info(`✅ All ${files.length} seed file(s) applied successfully`);
}

runSeeds()
  .then(async () => {
    await disconnectDatabase();
    process.exit(0);
  })
  .catch(async (error: Error) => {
    logger.error('Seeding failed', { error: error.message });
    await disconnectDatabase().catch(() => {});
    process.exit(1);
  });
