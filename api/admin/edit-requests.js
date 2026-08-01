// /api/admin/edit-requests — requires a valid admin session cookie.
//   GET  -> pending change requests, each with the guest's name and stated reason
//   POST -> resolve one (?id=<uuid>&action=approve|deny). Approving UNLOCKS the guest's RSVP.
import { sql } from '../../lib/db.js';
import { requireAdmin } from '../../lib/auth.js';

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;

  if (req.method === 'GET') {
    const { rows } = await sql`
      select e.id, e.guest_id, e.reason, e.requested_at, e.status, g.name, g.phone
      from edit_requests e join guests g on g.id = e.guest_id
      where e.status = 'pending'
      order by e.requested_at asc`;
    res.status(200).json({ ok: true, requests: rows });
    return;
  }

  if (req.method === 'POST') {
    const id = (req.query && req.query.id) || (req.body && req.body.id);
    const action = (req.query && req.query.action) || (req.body && req.body.action);
    if (!id || !['approve', 'deny'].includes(action)) { res.status(400).json({ ok: false, error: 'Bad request' }); return; }

    const er = await sql`select guest_id from edit_requests where id = ${id} and status = 'pending' limit 1`;
    const row = er.rows[0];
    if (!row) { res.status(404).json({ ok: false, error: 'Request not found' }); return; }

    if (action === 'approve') {
      await sql`update rsvps set locked = false where guest_id = ${row.guest_id}`;
      await sql`update edit_requests set status = 'approved', resolved_at = now() where id = ${id}`;
    } else {
      await sql`update edit_requests set status = 'denied', resolved_at = now() where id = ${id}`;
    }
    res.status(200).json({ ok: true });
    return;
  }

  res.status(405).json({ ok: false, error: 'Method not allowed' });
}
