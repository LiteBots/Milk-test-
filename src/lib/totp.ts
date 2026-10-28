import 'server-only';
import crypto from 'crypto';

// TOTP (RFC 6238) dla 2FA w panelu – zgodne z Google Authenticator, Authy, 1Password
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function newSecret(bytes = 20) {
  const buf = crypto.randomBytes(bytes);
  let bits = '';
  for (const b of buf) bits += b.toString(2).padStart(8, '0');
  let out = '';
  for (let i = 0; i + 5 <= bits.length; i += 5) out += B32[parseInt(bits.slice(i, i + 5), 2)];
  return out;
}

function b32decode(s: string) {
  const clean = s.replace(/=+$/, '').toUpperCase();
  let bits = '';
  for (const c of clean) {
    const v = B32.indexOf(c);
    if (v < 0) continue;
    bits += v.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

function hotp(secret: string, counter: number) {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const h = crypto.createHmac('sha1', b32decode(secret)).update(buf).digest();
  const o = h[h.length - 1] & 0xf;
  const code = ((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).toString().padStart(6, '0');
  return code;
}

export function verifyTotp(secret: string, code: string, window = 1) {
  const c = String(code || '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(c)) return false;
  const step = Math.floor(Date.now() / 30000);
  for (let w = -window; w <= window; w++) if (hotp(secret, step + w) === c) return true;
  return false;
}

export const otpauthUrl = (secret: string, account: string) =>
  `otpauth://totp/${encodeURIComponent(`MilkMi Panel:${account}`)}?secret=${secret}&issuer=${encodeURIComponent('MilkMi Panel')}&digits=6&period=30`;

export const totpNow = (secret: string) => hotp(secret, Math.floor(Date.now() / 30000));
