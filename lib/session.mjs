import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto';
export const SESSION_COOKIE = 'mts_zd_session';
export const STATE_COOKIE = 'mts_zd_oauth_state';
const MAX_SESSION_AGE = 7 * 24 * 3600;
export function secretKey(secret) {
  if (typeof secret !== 'string' || secret.length < 32) throw new Error('SESSION_SECRET must contain at least 32 characters');
  return createHash('sha256').update(secret, 'utf8').digest();
}
export function seal(payload, secret, time = Date.now()) {
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', secretKey(secret), nonce);
  const value = Buffer.from(JSON.stringify({ ...payload, issuedAt: time }), 'utf8');
  const encrypted = Buffer.concat([cipher.update(value), cipher.final()]);
  return Buffer.concat([nonce, cipher.getAuthTag(), encrypted]).toString('base64url');
}
export function unseal(value, secret, time = Date.now(), maxAge = MAX_SESSION_AGE * 1000) {
  try {
    const bytes = Buffer.from(value || '', 'base64url');
    if (bytes.length < 29) return null;
    const decipher = createDecipheriv('aes-256-gcm', secretKey(secret), bytes.subarray(0,12));
    decipher.setAuthTag(bytes.subarray(12,28));
    const data = JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString('utf8'));
    if (typeof data.issuedAt !== 'number' || data.issuedAt > time + 30000 || time - data.issuedAt > maxAge) return null;
    return data;
  } catch { return null; }
}
export function equalSecrets(a, b) {
  if (!a || !b) return false;
  const left = Buffer.from(a); const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
export function cookieOptions(production = process.env.NODE_ENV === 'production') {
  return { httpOnly: true, secure: production, sameSite: 'lax', path: '/', maxAge: MAX_SESSION_AGE };
}
