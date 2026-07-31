// Emergency setup endpoint - creates database schema. Only accessible once per deployment.
import { sql } from '../lib/db.js';

export default async function handler(req, res) {
  // Security: only allow POST requests and only from the same origin
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  // Additional safety: require a secret query param that's hard to guess
  if (req.query.secret !== 'setup-walima-2024') {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  try {
    console.log('Setting up database schema...');

    // Create extension
    await sql`create extension if not exists pgcrypto`;
    console.log('✓ pgcrypto extension');

    // Create guests table
    await sql`create table if not exists guests (
      id           uuid primary key default gen_random_uuid(),
      phone        text unique not null,
      name         text not null,
      language     text default 'en',
      created_at   timestamptz default now()
    )`;
    console.log('✓ guests table');

    // Create rsvps table
    await sql`create table if not exists rsvps (
      id           uuid primary key default gen_random_uuid(),
      guest_id     uuid references guests(id) on delete cascade,
      attending    boolean,
      party_size   int,
      message      text,
      submitted_at timestamptz default now(),
      locked       boolean default true
    )`;
    console.log('✓ rsvps table');

    // Create edit_requests table
    await sql`create table if not exists edit_requests (
      id           uuid primary key default gen_random_uuid(),
      guest_id     uuid references guests(id) on delete cascade,
      reason       text not null,
      requested_at timestamptz default now(),
      status       text default 'pending',
      resolved_at  timestamptz
    )`;
    console.log('✓ edit_requests table');

    // Create indexes
    await sql`create index if not exists idx_rsvps_guest on rsvps(guest_id)`;
    await sql`create index if not exists idx_edit_requests_guest on edit_requests(guest_id)`;
    await sql`create index if not exists idx_edit_requests_status on edit_requests(status)`;
    console.log('✓ indexes created');

    res.status(200).json({
      ok: true,
      message: 'Database schema setup complete!',
      tables: ['guests', 'rsvps', 'edit_requests']
    });
  } catch (error) {
    console.error('Setup error:', error);
    res.status(500).json({
      ok: false,
      error: 'Setup failed: ' + error.message
    });
  }
}
