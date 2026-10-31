import crypto from 'node:crypto';

const DEFAULT_ITERATIONS = 600000;

/**
 * Hash a plain-text password using Django-compatible PBKDF2-SHA256 format:
 *   pbkdf2_sha256$<iterations>$<salt>$<base64_digest>
 */
export function makePassword(plainPassword, salt = null, iterations = DEFAULT_ITERATIONS) {
  const pwd = String(plainPassword || '');
  const actualSalt = salt || crypto.randomBytes(12).toString('base64url');
  const digest = crypto
    .pbkdf2Sync(pwd, actualSalt, iterations, 32, 'sha256')
    .toString('base64');
  return `pbkdf2_sha256$${iterations}$${actualSalt}$${digest}`;
}

/**
 * Verify a plain-text password against Django's passwordHash formats:
 * 1. md5$<salt>$<hex_digest> (Django MD5PasswordHasher)
 * 2. pbkdf2_sha256$<iterations>$<salt>$<base64_digest> (Django PBKDF2PasswordHasher)
 */
export function checkPassword(plainPassword, encodedHash) {
  if (!plainPassword || !encodedHash || typeof encodedHash !== 'string') {
    return false;
  }

  const verifySingle = (pwd) => {
    const parts = encodedHash.split('$');
    const algorithm = parts[0];

    try {
      if (algorithm === 'md5' && parts.length === 3) {
        const [, salt, expectedHex] = parts;
        const computedHex = crypto
          .createHash('md5')
          .update(`${salt}${pwd}`, 'utf8')
          .digest('hex');
        const a = Buffer.from(computedHex, 'utf8');
        const b = Buffer.from(expectedHex, 'utf8');
        return a.length === b.length && crypto.timingSafeEqual(a, b);
      }

      if (algorithm === 'pbkdf2_sha256' && parts.length === 4) {
        const [, iterStr, salt, expectedB64] = parts;
        const iterations = parseInt(iterStr, 10);
        if (Number.isNaN(iterations) || iterations < 1) {
          return false;
        }
        const computedB64 = crypto
          .pbkdf2Sync(String(pwd), salt, iterations, 32, 'sha256')
          .toString('base64');
        const a = Buffer.from(computedB64, 'utf8');
        const b = Buffer.from(expectedB64, 'utf8');
        return a.length === b.length && crypto.timingSafeEqual(a, b);
      }
    } catch {
      return false;
    }
    return false;
  };

  if (verifySingle(plainPassword)) return true;

  // Gracefully verify mobile auto-capitalization variants (e.g. Sanjid123 vs sanjid123)
  const lower = String(plainPassword).toLowerCase();
  if (lower !== plainPassword && verifySingle(lower)) return true;

  const cap = String(plainPassword).charAt(0).toUpperCase() + String(plainPassword).slice(1);
  if (cap !== plainPassword && verifySingle(cap)) return true;

  return false;
}
