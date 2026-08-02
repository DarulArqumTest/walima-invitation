// POST /api/admin/import — bulk-add guests from a CSV upload.
// ADDS to the whitelist; it never clears it. Duplicates are skipped silently, both
// against guests already stored and against repeats within the same file.
//
// Matching uses the LAST 10 DIGITS, exactly like /api/verify — so "5551234567",
// "+1 555 123 4567" and "(555) 123-4567" are all recognised as the same guest and
// only one row is created.
import { sql } from '../../lib/db.js';
import { requireAdmin } from '../../lib/auth.js';

function tailOf(s) {
  const d = String(s || '').replace(/\D/g, '');
  return d.slice(-10);
}

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;
  if (req.method !== 'POST') { res.status(405).json({ ok: false, error: 'Method not allowed' }); return; }

  const rows = (req.body && Array.isArray(req.body.guests)) ? req.body.guests : null;
  if (!rows) { res.status(400).json({ ok: false, error: 'Expected a list of guests.' }); return; }
  if (rows.length > 2000) { res.status(400).json({ ok: false, error: 'Too many rows in one file (max 2000).' }); return; }

  try {
    // everything already on the list, keyed the same way the gate matches
    const existing = await sql`select right(regexp_replace(phone, '\\D', '', 'g'), 10) as tail from guests`;
    const seen = new Set(existing.rows.map((r) => r.tail).filter(Boolean));

    let added = 0, skipped = 0, invalid = 0;
    const invalidRows = [];
    const toAdd = [];
    // so reported row numbers line up with the spreadsheet the host is looking at
    const offset = Number(req.body && req.body.rowOffset) || 1;
    let idx = -1;

    for (const r of rows) {
      idx++;
      const name = String((r && r.name) || '').trim();
      const local = String((r && r.phone) || '').replace(/\D/g, '');
      let cc = String((r && r.cc) || '').trim();
      if (cc && cc[0] !== '+') cc = '+' + cc.replace(/\D/g, '');
      if (!cc) cc = '+1';                       // sensible default when the column is left blank

      if (!name || !local) { invalid++; invalidRows.push('row ' + (idx + offset) + (name ? ' – ' + name : '')); continue; }

      // If someone pasted the full international number into the phone column,
      // don't glue the dial code on a second time.
      const ccDigits = cc.replace(/\D/g, '');
      const alreadyPrefixed = local.length > 10 && local.startsWith(ccDigits);
      const full = alreadyPrefixed ? '+' + local
        : (local.length > 10 && !r.cc) ? '+' + local
        : cc + local;
      const tail = tailOf(full);
      if (tail.length < 7) { invalid++; invalidRows.push('row ' + (idx + offset) + ' – ' + name); continue; }
      if (seen.has(tail)) { skipped++; continue; }   // already on the list, or repeated in this file

      seen.add(tail);
      toAdd.push({ name, phone: full });
    }

    for (const g of toAdd) {
      await sql`
        insert into guests (name, phone, language) values (${g.name}, ${g.phone}, 'en')
        on conflict (phone) do nothing`;
      added++;
    }

    res.status(200).json({ ok: true, added, skipped, invalid, invalidRows: invalidRows.slice(0, 40), total: rows.length });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'Could not import that file.' });
  }
}
