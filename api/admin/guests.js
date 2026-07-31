// /api/admin/guests — all methods require a valid admin session cookie.
//   GET    -> guest list with each guest's latest RSVP (status, party size, message)
//   POST   -> add a guest (name, phone, language) — this is the whitelisting action
//   DELETE -> remove a guest (?id=<uuid>)
import { sql } from '../../lib/db.js';
import { requireAdmin } from '../../lib/auth.js';

function normPhone(s) { return String(s || '').replace(/[^\d+]/g, ''); }

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;

  if (req.method === 'GET') {
    const { rows } = await sql`
      select g.id, g.name, g.phone, g.language, g.created_at,
             r.attending, r.party_size, r.message, r.locked, r.submitted_at
      from guests g
      left join lateral (
        select attending, party_size, message, locked, submitted_at
        from rsvps where guest_id = g.id order by submitted_at desc limit 1
      ) r on true
      order by g.name asc`;
    res.status(200).json({ ok: true, guests: rows });
    return;
  }

  if (req.method === 'POST') {
    const name = String((req.body && req.body.name) || '').trim();
    const phone = normPhone(req.body && req.body.phone);
    const language = req.body && req.body.language === 'ur' ? 'ur' : 'en';
    if (!name || !phone) { res.status(400).json({ ok: false, error: 'Name and phone are required.' }); return; }
    try {
      const { rows } = await sql`
        insert into guests (name, phone, language) values (${name}, ${phone}, ${language})
        on conflict (phone) do update set name = excluded.name, language = excluded.language
        returning id, name, phone, language`;
      res.status(200).json({ ok: true, guest: rows[0] });
    } catch (e) {
      res.status(500).json({ ok: false, error: 'Could not add guest.' });
    }
    return;
  }

  if (req.method === 'DELETE') {
    const id = (req.query && req.query.id) || '';
    if (!id) { res.status(400).json({ ok: false, error: 'Missing id' }); return; }
    await sql`delete from guests where id = ${id}`;   // rsvps + edit_requests cascade
    res.status(200).json({ ok: true });
    return;
  }

  res.status(405).json({ ok: false, error: 'Method not allowed' });
}
