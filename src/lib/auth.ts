import 'server-only';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import type { StaffRole } from './models/core';

const secretRaw = process.env.AUTH_SECRET || process.env.JWT_SECRET || '';
if (!secretRaw && process.env.NODE_ENV === 'production') {
  console.warn('⚠️ AUTH_SECRET nie jest ustawiony – ustaw go w zmiennych Railway.');
}
const SECRET = new TextEncoder().encode(secretRaw || 'dev-only-secret-change-me-please-0123456789');

export const USER_COOKIE = 'mm_user';
export const STAFF_COOKIE = 'mm_staff';

export interface UserSession {
  kind: 'user';
  userId: string;
  name: string;
}
export interface StaffSession {
  kind: 'staff';
  staffId: string;
  name: string;
  role: StaffRole;
  locations: string[];
  pending2fa?: boolean;
}

export async function signSession(payload: UserSession | StaffSession, maxAgeSec: number) {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${maxAgeSec}s`)
    .sign(SECRET);
}

export async function verifyToken<T>(token?: string | null): Promise<T | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as unknown as T;
  } catch {
    return null;
  }
}

const cookieBase = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/'
};

export const USER_MAX_AGE = 60 * 60 * 24 * 60; // 60 dni
export const STAFF_MAX_AGE = 60 * 60 * 12; // 12 h

export async function setUserCookie(s: UserSession) {
  const token = await signSession(s, USER_MAX_AGE);
  (await cookies()).set(USER_COOKIE, token, { ...cookieBase, maxAge: USER_MAX_AGE });
}
export async function setStaffCookie(s: StaffSession) {
  const token = await signSession(s, STAFF_MAX_AGE);
  (await cookies()).set(STAFF_COOKIE, token, { ...cookieBase, maxAge: STAFF_MAX_AGE });
}
export async function clearCookie(name: string) {
  (await cookies()).set(name, '', { ...cookieBase, maxAge: 0 });
}

export async function getUserSession(): Promise<UserSession | null> {
  const s = await verifyToken<UserSession>((await cookies()).get(USER_COOKIE)?.value);
  return s && s.kind === 'user' ? s : null;
}

export async function getStaffSession(): Promise<StaffSession | null> {
  const s = await verifyToken<StaffSession>((await cookies()).get(STAFF_COOKIE)?.value);
  return s && s.kind === 'staff' && !s.pending2fa ? s : null;
}

export { PERMISSIONS, can, type Permission } from './permissions';

export function canLocation(session: StaffSession, location: string) {
  return session.role === 'owner' || session.locations.length === 0 || session.locations.includes(location);
}
