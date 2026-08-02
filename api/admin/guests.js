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
             r.attending, r.party_size, r.message, r.locked, r.submitted_at,
             r.host_note, r.note_seen, r.edited_by_host
      from guests g
      left join lateral (
        select attending, party_size, message, locked, submitted_at, host_note, note_seen, edited_by_host
        from rsvps where guest_id = g.id order by submitted_at desc limit 1
      ) r on true
      order by g.name asc`;
    res.status(200).json({ ok: true, guests: rows });
    return;
  }

  // PATCH — the host editing a guest's response directly, and/or leaving them a note.
  // This replaces the old "approve the edit request and wait for the guest to resubmit" loop.
  if (req.method === 'PATCH') {
    const b = req.body || {};
    const gid = String(b.guest_id || '');
    if (!gid) { res.status(400).json({ ok: false, error: 'Missing guest_id' }); return; }

    const has = (k) => Object.prototype.hasOwnProperty.call(b, k);
    const attending = has('attending') ? (b.attending === null ? null : !!b.attending) : undefined;
    const party = has('party_size') ? Math.max(0, Math.min(20, parseInt(b.party_size, 10) || 0)) : undefined;
    const note = has('host_note') ? (String(b.host_note || '').slice(0, 2000) || null) : undefined;

    // Identity edits — for fixing a typo'd number or a missing name without having
    // to delete the guest and lose their response.
    try {
      if (has('name')) {
        const nm = String(b.name || '').trim();
        if (!nm) { res.status(400).json({ ok: false, error: 'Name cannot be empty.' }); return; }
        await sql`update guests set name = ${nm} where id = ${gid}`;
      }
      if (has('phone')) {
        const ph = normPhone(b.phone);
        const tail = ph.replace(/\D/g, '').slice(-10);
        if (tail.length < 7) { res.status(400).json({ ok: false, error: 'That phone number looks too short.' }); return; }
        // the gate matches on the last 10 digits, so a "different" string that
        // resolves to an existing guest would let two rows share one identity
        const clash = await sql`
          select id from guests
          where id <> ${gid} and right(regexp_replace(phone, '\\D', '', 'g'), 10) = ${tail}
          limit 1`;
        if (clash.rows[0]) { res.status(409).json({ ok: false, error: 'Another guest already has that number.' }); return; }
        await sql`update guests set phone = ${ph} where id = ${gid}`;
      }
    } catch (e) {
      res.status(500).json({ ok: false, error: 'Could not update those details.' }); return;
    }

    // Only touch the RSVP if the host actually changed something about it. Otherwise
    // correcting a name would mint an empty locked RSVP and flip a guest who hasn't
    // replied yet out of "No response".
    const touchesRsvp = attending !== undefined || party !== undefined || note !== undefined;
    if (!touchesRsvp) {
      const g = await sql`select id, name, phone from guests where id = ${gid}`;
      res.status(200).json({ ok: true, guest: g.rows[0] });
      return;
    }

    try {
      const cur = await sql`select id from rsvps where guest_id = ${gid} order by submitted_at desc limit 1`;
      let id = cur.rows[0] && cur.rows[0].id;
      if (!id) {
        // no response yet — create one so the host can still record/adjust it
        const ins = await sql`
          insert into rsvps (guest_id, attending, party_size, locked, edited_by_host)
          values (${gid}, ${attending === undefined ? null : attending}, ${party === undefined ? 0 : party}, true, true)
          returning id`;
        id = ins.rows[0].id;
      }
      if (attending !== undefined) await sql`update rsvps set attending = ${attending}, edited_by_host = true where id = ${id}`;
      if (party !== undefined)     await sql`update rsvps set party_size = ${party}, edited_by_host = true where id = ${id}`;
      // a fresh note is unread again, so the guest sees it next time they open the invitation
      if (note !== undefined)      await sql`update rsvps set host_note = ${note}, note_seen = false where id = ${id}`;

      const out = await sql`
        select attending, party_size, message, locked, host_note, note_seen, edited_by_host
        from rsvps where id = ${id}`;
      res.status(200).json({ ok: true, rsvp: out.rows[0] });
    } catch (e) {
      res.status(500).json({ ok: false, error: 'Could not update response.' });
    }
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
