# Walima Invitation

An interactive wedding invitation. A guest enters their phone number, a pair of doors swings
open into a candle-lit study, a wax-sealed envelope rises and opens, and the invitation is
revealed and addressed to them by name. Guests RSVP inline; the couple manage the guest list
and responses from an admin panel.

**Stack:** static HTML + WebGL (three.js) frontend · Vercel serverless functions · Vercel Postgres.
No build step, no framework runtime.

> **Deploying?** Follow **[SETUP.md](./SETUP.md)** — it is the step-by-step deploy guide.

---

## Architecture

```
Browser (public/)                     Server (api/ + lib/)              Database
─────────────────                     ────────────────────              ────────
index.html  ── POST /api/verify ───►  verify.js  ── looks up ────────►  guests
 (WebGL, gate)   {phone}              (rate-limited, sets              rsvps
                                       signed httpOnly cookie)          edit_requests
            ── GET/POST /api/rsvp ─►  rsvp.js    (reads cookie only)
            ── POST /api/edit-request edit-request.js
admin/index ── /api/admin/* ───────►  admin/*    (requires admin cookie)
```

**The browser never receives the guest list or any secret.** Guest identity is resolved
server-side from a signed, httpOnly session cookie set at `/api/verify`. `content.js` (the only
data file shipped to the browser) contains **wording only**.

### Sessions
Stateless HMAC-SHA256 tokens (`lib/auth.js`) signed with `SESSION_SECRET`, stored in
`HttpOnly; Secure; SameSite=Lax` cookies. Guest session lasts 30 days; admin session 8 hours.

### Data model (`db/schema.sql`)
- **guests** — `id, phone (unique), name, language, created_at`. The whitelist.
- **rsvps** — `guest_id, attending, party_size, message, locked, submitted_at`. Submitting
  sets `locked=true`; an approved change request sets it back to `false`.
- **edit_requests** — `guest_id, reason, status (pending|approved|denied), …`.

---

## Routes

**Guest (session cookie from `/api/verify`):**
| Method | Path | Purpose |
|---|---|---|
| POST | `/api/verify` | phone → guest; sets guest cookie. Rate-limited; generic failure. |
| GET  | `/api/rsvp` | the guest's current RSVP (or null). |
| POST | `/api/rsvp` | submit RSVP; locks it. 409 if already locked. |
| POST | `/api/edit-request` | request to reopen a locked RSVP, with a reason. |

**Admin (admin cookie from `/api/admin/login`):**
| Method | Path | Purpose |
|---|---|---|
| POST | `/api/admin/login` | verify `ADMIN_PASSWORD`; set admin cookie. |
| GET / POST / DELETE | `/api/admin/guests` | list · add (whitelist) · remove. |
| GET / POST | `/api/admin/edit-requests` | list pending · approve (unlocks RSVP) / deny. |
| GET | `/api/admin/export` | guest list as CSV. |

---

## Environment variables
See `.env.example`. `POSTGRES_*` are injected by Vercel when you attach a Postgres store.
You set `ADMIN_PASSWORD` and `SESSION_SECRET` yourself.

## Editing the wording
`public/content.js` — hosts, names, date, venue, programme, in English and Urdu. No redeploy
logic needed; it's a static file.

## Local dev
`vercel dev` after `vercel link` + `vercel env pull`. See SETUP.md.
