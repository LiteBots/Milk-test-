import 'server-only';
import crypto from 'crypto';

const key = () => process.env.AUTH_SECRET || process.env.JWT_SECRET || 'dev-only-secret-change-me-please-0123456789';

// Podpis linku do statusu zamówienia / odwołania rezerwacji – bez logowania, bez zgadywania ID
export function signId(kind: string, id: string) {
  return crypto.createHmac('sha256', key()).update(`${kind}:${id}`).digest('base64url').slice(0, 24);
}

export function verifyId(kind: string, id: string, token: string | null | undefined) {
  if (!token) return false;
  const expected = signId(kind, id);
  return token.length === expected.length && crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
}

export const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
