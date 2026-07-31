// POST /api/verify  — phone in, guest out. Issues a signed httpOnly session cookie.
// The phone number is effectively the password on this site, so this route is rate limited
// and returns an IDENTICAL generic failure whether the number is unknown OR throttled.
import { sql } from '../lib/db.js';
import { sign, setCookie, GUEST_COOKIE } from '../lib/auth.js';

const WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 6;               // per IP per minute — plenty for a real guest
const hits = new Map();               // ip -> [timestamps]  (best-effort, per serverless instance)

const GENERIC = "We couldn't find that number. Please check with the couple.";

function clientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  const first = (Array.isArray(xf) ? xf[0] : (xf || '')).split(',')[0].trim();
  return first || req.socket?.remoteAddress || 'unknown';
}

function throttled(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 5000) { for (const k of hits.keys()) { if (hits.size <= 2500) break; hits.delete(k); } }
  return arr.length > MAX_ATTEMPTS;
}

function normPhone(s) { return String(s || '').replace(/[^\d+]/g, ''); }

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ ok: false, error: 'Method not allowed' }); return; }

  const ip = clientIp(req);
  // Same status + body for throttled and not-found — never reveal which.
  if (throttled(ip)) { res.status(401).json({ ok: false, message: GENERIC }); return; }

  const phone = normPhone(req.body && req.body.phone);
  if (!phone) { res.status(401).json({ ok: false, message: GENERIC }); return; }

  try {
    const { rows } = await sql`select id, name, language from guests where phone = ${phone} limit 1`;
    const g = rows[0];
    if (!g) { res.status(401).json({ ok: false, message: GENERIC }); return; }

    // 30-day guest session so returning guests don't re-enter their number.
    setCookie(res, GUEST_COOKIE, sign({ gid: g.id, iat: Date.now() }), 60 * 60 * 24 * 30);
    res.status(200).json({ ok: true, guest: { name: g.name, language: g.language || 'en' } });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'Server error' });
  }
}
