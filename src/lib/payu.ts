import 'server-only';
import crypto from 'crypto';
import { SITE_URL } from './site';

const BASE = process.env.PAYU_ENV === 'secure' ? 'https://secure.payu.com' : 'https://secure.snd.payu.com';

export const payuConfigured = () => !!(process.env.PAYU_POS_ID && process.env.PAYU_CLIENT_ID && process.env.PAYU_CLIENT_SECRET);

let cachedToken: { token: string; exp: number } | null = null;

async function token(): Promise<string> {
  if (cachedToken && cachedToken.exp > Date.now() + 60_000) return cachedToken.token;
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: process.env.PAYU_CLIENT_ID || '',
    client_secret: process.env.PAYU_CLIENT_SECRET || ''
  });
  const res = await fetch(`${BASE}/pl/standard/user/oauth/authorize`, {
    method: 'POST',
    body,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  });
  const data = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number };
  if (!res.ok || !data.access_token) throw new Error('Nieudana autoryzacja z PayU.');
  cachedToken = { token: data.access_token, exp: Date.now() + (data.expires_in || 3600) * 1000 };
  return data.access_token;
}

export interface PayuOrderInput {
  extOrderId: string; // np. "order:<id>", "topup:<id>", "gift:<id>"
  description: string;
  totalAmount: number; // PLN
  customerIp: string;
  buyer: { email?: string; phone?: string; firstName?: string };
  products: { name: string; unitPrice: number; quantity: number }[];
  continuePath: string;
}

export async function createPayuOrder(input: PayuOrderInput): Promise<{ redirectUri: string; orderId?: string }> {
  const t = await token();
  const res = await fetch(`${BASE}/api/v2_1/orders`, {
    method: 'POST',
    redirect: 'manual',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
    body: JSON.stringify({
      notifyUrl: `${SITE_URL}/api/payu/notify`,
      continueUrl: `${SITE_URL}${input.continuePath}`,
      customerIp: input.customerIp && input.customerIp !== 'unknown' ? input.customerIp : '127.0.0.1',
      merchantPosId: process.env.PAYU_POS_ID,
      description: input.description,
      currencyCode: 'PLN',
      totalAmount: Math.round(input.totalAmount * 100),
      extOrderId: input.extOrderId,
      buyer: { language: 'pl', ...input.buyer },
      products: input.products.map((p) => ({ name: p.name.slice(0, 250), unitPrice: Math.round(p.unitPrice * 100), quantity: p.quantity }))
    })
  });
  const loc = res.headers.get('location');
  if (res.status === 302 && loc) return { redirectUri: loc };
  const data = (await res.json().catch(() => ({}))) as { redirectUri?: string; orderId?: string; status?: { statusCode?: string } };
  if (!data.redirectUri) {
    console.error('[PayU] odrzucone zamówienie', res.status, data);
    throw new Error('Nie udało się rozpocząć płatności PayU.');
  }
  return { redirectUri: data.redirectUri, orderId: data.orderId };
}

export function verifyPayuSignature(rawBody: string, header: string | null): boolean {
  const key = process.env.PAYU_SECOND_KEY;
  if (!key || !header) return false;
  const parts = Object.fromEntries(header.split(';').map((p) => p.split('=') as [string, string]));
  const algo = String(parts.algorithm || 'MD5').toUpperCase() === 'SHA256' ? 'sha256' : 'md5';
  const expected = crypto.createHash(algo).update(rawBody + key).digest('hex');
  const sig = String(parts.signature || '');
  return sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}

export async function getPayuOrder(orderId: string): Promise<{ status: string; extOrderId: string; totalAmount: string } | null> {
  const t = await token();
  const res = await fetch(`${BASE}/api/v2_1/orders/${encodeURIComponent(orderId)}`, { headers: { Authorization: `Bearer ${t}` } });
  const data = (await res.json().catch(() => ({}))) as { orders?: { status: string; extOrderId: string; totalAmount: string }[] };
  return data.orders?.[0] || null;
}

export async function refundPayu(orderId: string, description: string, amount?: number): Promise<boolean> {
  const t = await token();
  const res = await fetch(`${BASE}/api/v2_1/orders/${encodeURIComponent(orderId)}/refunds`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
    body: JSON.stringify({ refund: { description, ...(amount ? { amount: Math.round(amount * 100) } : {}) } })
  });
  if (!res.ok) console.error('[PayU] zwrot nieudany', res.status, await res.text());
  return res.ok;
}
