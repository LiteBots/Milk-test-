import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { headers } from 'next/headers';
import type { ZodTypeAny, infer as ZInfer } from 'zod';
import { db } from './db';
import { RateLimit } from './models';
import { getStaffSession, getUserSession, can, type Permission, type StaffSession, type UserSession } from './auth';

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const ok = <T extends object>(data: T = {} as T, init?: ResponseInit) =>
  NextResponse.json({ success: true, ...data }, init);

export const fail = (status: number, message: string) => NextResponse.json({ success: false, message }, { status });

// Opakowanie handlerów: łączy z bazą i zamienia wyjątki na czytelne odpowiedzi JSON
export function handler<C = unknown>(fn: (req: NextRequest, ctx: C) => Promise<Response>) {
  return async (req: NextRequest, ctx: C) => {
    try {
      await db();
      return await fn(req, ctx);
    } catch (e) {
      if (e instanceof HttpError) return fail(e.status, e.message);
      console.error('[API]', req.method, req.nextUrl.pathname, e);
      return fail(500, 'Wystąpił błąd serwera. Spróbuj ponownie.');
    }
  };
}

export async function parseBody<S extends ZodTypeAny>(req: NextRequest, schema: S): Promise<ZInfer<S>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new HttpError(400, 'Nieprawidłowe dane.');
  }
  const r = schema.safeParse(raw);
  if (!r.success) {
    const first = r.error.issues[0];
    throw new HttpError(400, first?.message && !first.message.startsWith('Expected') ? first.message : 'Sprawdź wprowadzone dane.');
  }
  return r.data;
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get('x-forwarded-for') || '').split(',')[0].trim() || h.get('x-real-ip') || 'unknown';
}

// Limit prób w oknie czasowym, trzymany w MongoDB (TTL)
export async function rateLimit(key: string, max: number, windowSec: number) {
  const ip = await clientIp();
  const id = `${key}:${ip}`;
  const now = new Date();
  const doc = await RateLimit.findOneAndUpdate(
    { key: id, expiresAt: { $gt: now } },
    { $inc: { count: 1 } },
    { new: true }
  );
  if (!doc) {
    await RateLimit.updateOne(
      { key: id },
      { $set: { count: 1, expiresAt: new Date(now.getTime() + windowSec * 1000) } },
      { upsert: true }
    );
    return;
  }
  if (doc.count > max) throw new HttpError(429, 'Zbyt wiele prób. Spróbuj ponownie za kilka minut.');
}

export async function requireUser(): Promise<UserSession> {
  const s = await getUserSession();
  if (!s) throw new HttpError(401, 'Zaloguj się, aby kontynuować.');
  return s;
}

export async function requireStaff(perm?: Permission): Promise<StaffSession> {
  const s = await getStaffSession();
  if (!s) throw new HttpError(401, 'Sesja wygasła – zaloguj się ponownie.');
  if (perm && !can(s, perm)) throw new HttpError(403, 'Brak uprawnień do tej sekcji.');
  return s;
}
