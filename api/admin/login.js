// POST /api/admin/login — verifies ADMIN_PASSWORD server-side (never in the browser),
// then issues a signed httpOnly, Secure, SameSite admin session cookie (8 hours).
import crypto from 'node:crypto';
import { sign, setCookie, ADMIN_COOKIE } from '../../lib/auth.js';

function safeEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ ok: false, error: 'Method not allowed' }); return; }

  const password = (req.body && req.body.password) || '';
  const expected = process.env.ADMIN_PASSWORD || '';
  if (!expected) { res.status(500).json({ ok: false, error: 'ADMIN_PASSWORD not configured' }); return; }

  if (!safeEqual(password, expected)) { res.status(401).json({ ok: false, error: 'Incorrect password' }); return; }

  setCookie(res, ADMIN_COOKIE, sign({ role: 'admin', iat: Date.now() }), 60 * 60 * 8);
  res.status(200).json({ ok: true });
}
