// POST /api/edit-request — a locked guest asks for their RSVP to be reopened, with a reason.
// The admin approves or denies it in the panel. A guest can have at most one pending request.
import { sql } from '../lib/db.js';
import { getGuestSession } from '../lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ ok: false, error: 'Method not allowed' }); return; }

  const session = getGuestSession(req);
  if (!session) { res.status(401).json({ ok: false, error: 'Not signed in' }); return; }

  const reason = req.body && typeof req.body.reason === 'string' ? req.body.reason.trim().slice(0, 1000) : '';
  if (!reason) { res.status(400).json({ ok: false, error: 'A reason is required.' }); return; }

  const pending = await sql`select id from edit_requests where guest_id = ${session.gid} and status = 'pending' limit 1`;
  if (pending.rows[0]) {
    await sql`update edit_requests set reason = ${reason}, requested_at = now() where id = ${pending.rows[0].id}`;
  } else {
    await sql`insert into edit_requests (guest_id, reason) values (${session.gid}, ${reason})`;
  }
  res.status(200).json({ ok: true });
}
