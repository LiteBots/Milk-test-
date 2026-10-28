import 'server-only';
import webpush from 'web-push';
import type { Types } from 'mongoose';
import { PushSubscription } from './models';
import { escapeHtml } from './util';
import { BRAND, SITE_URL } from './site';

/* ---------------- E-MAIL (Resend REST API) ---------------- */
export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.info(`[e-mail pominięty – brak RESEND_API_KEY] do: ${to} | ${subject}`);
    return false;
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.EMAIL_FROM || `${BRAND.name} <onboarding@resend.dev>`, to: [to], subject, html })
    });
    if (!res.ok) console.error('[e-mail] błąd Resend', res.status, await res.text());
    return res.ok;
  } catch (e) {
    console.error('[e-mail] wyjątek', e);
    return false;
  }
}

// Prosty, spójny szablon wiadomości
export function emailLayout(title: string, bodyHtml: string, cta?: { label: string; url: string }) {
  return `<!doctype html><html lang="pl"><body style="margin:0;background:#F8FAFC;font-family:Arial,Helvetica,sans-serif;color:#0F172A">
  <div style="max-width:520px;margin:0 auto;padding:32px 24px">
    <div style="font-size:20px;font-weight:700;letter-spacing:-0.02em;margin-bottom:24px">${BRAND.name}</div>
    <div style="background:#fff;border:1px solid #ECE6DC;border-radius:16px;padding:28px">
      <h1 style="font-size:22px;margin:0 0 12px">${escapeHtml(title)}</h1>
      <div style="font-size:15px;line-height:1.6;color:#4A453E">${bodyHtml}</div>
      ${cta ? `<a href="${cta.url}" style="display:inline-block;margin-top:20px;background:#FF6600;color:#fff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:700">${escapeHtml(cta.label)}</a>` : ''}
    </div>
    <p style="font-size:12px;color:#8A8377;margin-top:20px">${BRAND.legalName} · ${BRAND.legalAddress} · <a href="${SITE_URL}" style="color:#8A8377">${SITE_URL.replace(/^https?:\/\//, '')}</a></p>
  </div></body></html>`;
}

/* ---------------- SMS (SMSAPI.pl) ---------------- */
export async function sendSms(phone: string, message: string): Promise<boolean> {
  const token = process.env.SMSAPI_TOKEN;
  if (!token) {
    console.info(`[SMS pominięty – brak SMSAPI_TOKEN] do: ${phone} | ${message}`);
    return false;
  }
  const to = phone.replace(/\D/g, '').replace(/^(?!48)(\d{9})$/, '48$1');
  try {
    const params = new URLSearchParams({ to, message, format: 'json', encoding: 'utf-8' });
    if (process.env.SMS_SENDER) params.set('from', process.env.SMS_SENDER);
    const res = await fetch('https://api.smsapi.pl/sms.do', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || (data as { error?: unknown }).error) console.error('[SMS] błąd', data);
    return res.ok;
  } catch (e) {
    console.error('[SMS] wyjątek', e);
    return false;
  }
}

/* ---------------- WEB PUSH ---------------- */
let vapidReady = false;
function initVapid() {
  if (vapidReady) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || `mailto:${BRAND.email}`, pub, priv);
  vapidReady = true;
  return true;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

async function pushTo(filter: Record<string, unknown>, payload: PushPayload): Promise<number> {
  if (!initVapid()) {
    console.info('[push pominięty – brak kluczy VAPID]', payload.title);
    return 0;
  }
  const subs = await PushSubscription.find(filter).lean();
  let sent = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, JSON.stringify(payload), { TTL: 60 * 60 });
        sent++;
      } catch (e: unknown) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await PushSubscription.deleteOne({ endpoint: s.endpoint });
      }
    })
  );
  return sent;
}

export const pushToUser = (userId: Types.ObjectId | string, payload: PushPayload, topic: 'orders' | 'marketing' = 'orders') =>
  pushTo({ userId, topics: topic }, payload);

export const pushToUsers = (userIds: (Types.ObjectId | string)[], payload: PushPayload) =>
  pushTo({ userId: { $in: userIds }, topics: 'marketing' }, payload);

export const pushToStaff = (payload: PushPayload) => pushTo({ staffId: { $ne: null } }, payload);
