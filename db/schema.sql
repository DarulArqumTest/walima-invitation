-- Walima invitation — database schema.
-- Run ONCE against the Vercel Postgres instance (Vercel dashboard -> Storage -> your
-- database -> Query, or `psql "$POSTGRES_URL" -f db/schema.sql`).

-- gen_random_uuid() lives in pgcrypto. Vercel Postgres (Neon) ships it; enable to be safe.
create extension if not exists pgcrypto;

create table if not exists guests (
  id           uuid primary key default gen_random_uuid(),
  phone        text unique not null,
  name         text not null,
  language     text default 'en',
  created_at   timestamptz default now()
);

create table if not exists rsvps (
  id           uuid primary key default gen_random_uuid(),
  guest_id     uuid references guests(id) on delete cascade,
  attending    boolean,
  party_size   int,
  message      text,
  submitted_at timestamptz default now(),
  locked       boolean default true
);

create table if not exists edit_requests (
  id           uuid primary key default gen_random_uuid(),
  guest_id     uuid references guests(id) on delete cascade,
  reason       text not null,
  requested_at timestamptz default now(),
  status       text default 'pending',   -- pending | approved | denied
  resolved_at  timestamptz
);

create index if not exists idx_rsvps_guest on rsvps(guest_id);
create index if not exists idx_edit_requests_guest on edit_requests(guest_id);
create index if not exists idx_edit_requests_status on edit_requests(status);
