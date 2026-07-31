// GET /api/admin/export — requires a valid admin session cookie. Returns the guest list as
// a CSV download (the file you hand the caterer).
import { sql } from '../../lib/db.js';
import { requireAdmin } from '../../lib/auth.js';

function csvCell(v) {
  if (v == null) return '';
  const s = String(v);
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;

  const { rows } = await sql`
    select g.name, g.phone, g.language,
           r.attending, r.party_size, r.message, r.submitted_at
    from guests g
    left join lateral (
      select attending, party_size, message, submitted_at
      from rsvps where guest_id = g.id order by submitted_at desc limit 1
    ) r on true
    order by g.name asc`;

  const header = ['Name', 'Phone', 'Language', 'Status', 'Party size', 'Message', 'Responded at'];
  const lines = [header.join(',')];
  for (const g of rows) {
    const status = g.attending == null ? 'No response' : (g.attending ? 'Attending' : 'Declined');
    lines.push([
      g.name, g.phone, g.language || 'en', status,
      g.attending ? (g.party_size || '') : '',
      g.message || '',
      g.submitted_at ? new Date(g.submitted_at).toISOString() : '',
    ].map(csvCell).join(','));
  }

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="walima-guests.csv"');
  res.status(200).send(lines.join('\r\n'));
}
