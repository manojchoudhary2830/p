/**
 * generate-keys.ts
 * Run: npm run keys:generate
 *
 * Generates an RSA-2048 key pair for JWT RS256 signing and writes them to
 * the `keys/` directory (which is git-ignored — never commit these).
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

const KEYS_DIR = path.resolve(process.cwd(), 'keys');
const PRIVATE_KEY_PATH = path.join(KEYS_DIR, 'private.pem');
const PUBLIC_KEY_PATH  = path.join(KEYS_DIR, 'public.pem');

function generateKeyPair(): void {
  if (!fs.existsSync(KEYS_DIR)) {
    fs.mkdirSync(KEYS_DIR, { recursive: true });
    console.log(`Created keys/ directory at ${KEYS_DIR}`);
  }

  if (fs.existsSync(PRIVATE_KEY_PATH) || fs.existsSync(PUBLIC_KEY_PATH)) {
    console.warn('⚠️  Key files already exist in keys/. Delete them manually if you want to regenerate.');
    console.warn(`   ${PRIVATE_KEY_PATH}`);
    console.warn(`   ${PUBLIC_KEY_PATH}`);
    process.exit(0);
  }

  console.log('Generating RSA-2048 key pair for JWT RS256…');

  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding:  { type: 'spki',  format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  fs.writeFileSync(PRIVATE_KEY_PATH, privateKey, { mode: 0o600 });
  fs.writeFileSync(PUBLIC_KEY_PATH,  publicKey,  { mode: 0o644 });

  console.log('');
  console.log('✅  Key pair generated successfully:');
  console.log(`   Private key: ${PRIVATE_KEY_PATH}  (keep secret, chmod 600)`);
  console.log(`   Public key:  ${PUBLIC_KEY_PATH}`);
  console.log('');
  console.log('Next steps:');
  console.log('  1. Set JWT_PRIVATE_KEY_PATH=./keys/private.pem in .env.production');
  console.log('  2. Set JWT_PUBLIC_KEY_PATH=./keys/public.pem  in .env.production');
  console.log('  3. Never commit keys/ to git (already in .gitignore)');
}

generateKeyPair();
