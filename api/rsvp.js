// GET  /api/rsvp  — the signed-in guest's own RSVP (or null).
// POST /api/rsvp  — submit; locks the RSVP. Blocked if already locked (until admin unlocks).
// The guest is identified ONLY by the signed session cookie — the phone number is never re-sent.
import { sql } from '../lib/db.js';
import { getGuestSession } from '../lib/auth.js';

export default async function handler(req, res) {
  const session = getGuestSession(req);
  if (!session) { res.status(401).json({ ok: false, error: 'Not signed in' }); return; }
  const gid = session.gid;

  if (req.method === 'GET') {
    const { rows } = await sql`
      select attending, party_size, message, locked, submitted_at
      from rsvps where guest_id = ${gid}
      order by submitted_at desc limit 1`;
    res.status(200).json({ ok: true, rsvp: rows[0] || null });
    return;
  }

  if (req.method === 'POST') {
    const cur = await sql`select id, locked from rsvps where guest_id = ${gid} order by submitted_at desc limit 1`;
    const latest = cur.rows[0];
    if (latest && latest.locked) { res.status(409).json({ ok: false, error: 'Your RSVP is locked.' }); return; }

    const b = req.body || {};
    const attending = !!b.attending;
    const party = attending ? Math.max(1, Math.min(20, parseInt(b.party_size, 10) || 1)) : 0;
    const message = typeof b.message === 'string' ? b.message.slice(0, 2000) : null;

    if (latest && !latest.locked) {
      await sql`update rsvps set attending=${attending}, party_size=${party}, message=${message}, submitted_at=now(), locked=true where id=${latest.id}`;
    } else {
      await sql`insert into rsvps (guest_id, attending, party_size, message, locked) values (${gid}, ${attending}, ${party}, ${message}, true)`;
    }
    res.status(200).json({ ok: true, locked: true });
    return;
  }

  res.status(405).json({ ok: false, error: 'Method not allowed' });
}
