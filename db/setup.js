// Setup script to create database tables. Run with: node db/setup.js
import { sql } from '@vercel/postgres';

async function setup() {
  try {
    console.log('Creating database schema...');

    // Create extension
    await sql`create extension if not exists pgcrypto`;
    console.log('✓ pgcrypto extension created');

    // Create guests table
    await sql`create table if not exists guests (
      id           uuid primary key default gen_random_uuid(),
      phone        text unique not null,
      name         text not null,
      language     text default 'en',
      created_at   timestamptz default now()
    )`;
    console.log('✓ guests table created');

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
    console.log('✓ rsvps table created');

    // Create edit_requests table
    await sql`create table if not exists edit_requests (
      id           uuid primary key default gen_random_uuid(),
      guest_id     uuid references guests(id) on delete cascade,
      reason       text not null,
      requested_at timestamptz default now(),
      status       text default 'pending',
      resolved_at  timestamptz
    )`;
    console.log('✓ edit_requests table created');

    // Create indexes
    await sql`create index if not exists idx_rsvps_guest on rsvps(guest_id)`;
    console.log('✓ idx_rsvps_guest index created');

    await sql`create index if not exists idx_edit_requests_guest on edit_requests(guest_id)`;
    console.log('✓ idx_edit_requests_guest index created');

    await sql`create index if not exists idx_edit_requests_status on edit_requests(status)`;
    console.log('✓ idx_edit_requests_status index created');

    console.log('\n✅ Database schema setup complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  }
}

setup();
