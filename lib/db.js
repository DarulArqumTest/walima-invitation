// Server-side Postgres client. Uses @vercel/postgres, which reads the POSTGRES_URL
// connection string that Vercel injects when a Postgres store is attached to the project.
// This module is imported ONLY by /api serverless functions — never by anything served
// to the browser, so the database credential never leaves the server.
import { sql } from '@vercel/postgres';

export { sql };
