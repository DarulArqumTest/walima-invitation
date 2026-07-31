// Cookie signing / verification and session helpers.
// Sessions are stateless: a small JSON payload signed with HMAC-SHA256 using SESSION_SECRET,
// stored in an httpOnly, Secure, SameSite=Lax cookie. The browser cannot read or forge it.
import crypto from 'node:crypto';

const SECRET = process.env.SESSION_SECRET || '';

export const GUEST_COOKIE = 'walima_guest';
export const ADMIN_COOKIE = 'walima_admin';

function b64url(input) { return Buffer.from(input).toString('base64url'); }

// ---- token: base64url(payloadJSON) + "." + base64url(hmac) ----
export function sign(payload) {
  if (!SECRET) throw new Error('SESSION_SECRET is not set');
  const body = b64url(JSON.stringify(payload));
  const mac = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  return body + '.' + mac;
}

export function verify(token) {
  if (!token || !SECRET) return null;
  const dot = token.lastIndexOf('.');
  if (dot < 0) return null;
  const body = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  const expected = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try { return JSON.parse(Buffer.from(body, 'base64url').toString('utf8')); }
  catch { return null; }
}

// ---- cookie plumbing ----
export function parseCookies(req) {
  const header = req.headers.cookie || '';
  const out = {};
  header.split(';').forEach((part) => {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  });
  return out;
}

function appendSetCookie(res, cookie) {
  const prev = res.getHeader('Set-Cookie');
  if (!prev) res.setHeader('Set-Cookie', cookie);
  else res.setHeader('Set-Cookie', Array.isArray(prev) ? prev.concat(cookie) : [prev, cookie]);
}

export function setCookie(res, name, value, maxAgeSec) {
  const parts = [`${name}=${encodeURIComponent(value)}`, 'Path=/', 'HttpOnly', 'Secure', 'SameSite=Lax'];
  if (maxAgeSec != null) parts.push(`Max-Age=${maxAgeSec}`);
  appendSetCookie(res, parts.join('; '));
}

export function clearCookie(res, name) {
  appendSetCookie(res, `${name}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
}

// ---- session readers ----
export function getGuestSession(req) {
  return verify(parseCookies(req)[GUEST_COOKIE]);
}

export function getAdminSession(req) {
  const s = verify(parseCookies(req)[ADMIN_COOKIE]);
  return s && s.role === 'admin' ? s : null;
}

// Guard for admin routes: returns the session, or writes 401 and returns null.
export function requireAdmin(req, res) {
  const s = getAdminSession(req);
  if (!s) { res.status(401).json({ ok: false, error: 'Unauthorized' }); return null; }
  return s;
}
