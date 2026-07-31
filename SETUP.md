# SETUP — deploy the Walima invitation (for Claude Code / a developer)

You are looking at a **complete, ready-to-deploy** web app: a WebGL wedding invitation
with a phone-gated RSVP flow, plus a password-protected admin panel. It runs on **Vercel**
(static frontend + serverless API) with **Vercel Postgres** as the database.

Your job is to deploy it and wire up the database. **Do not rewrite the app.** Follow these
steps in order. It should take ~15 minutes.

---

## What's in this repo

```
public/            ← STATIC, served to the browser (safe to be public)
  index.html         the invitation (WebGL entry, gate, RSVP)
  admin/index.html   the admin panel
  content.js         invitation wording (EN + UR) — NO guest data, NO secrets
  letter3d.js        the 3D scene
  assets/            textures / art the 3D scene loads
api/               ← SERVERLESS functions, run ONLY on the server
  verify.js          POST /api/verify        phone → session cookie
  rsvp.js            GET/POST /api/rsvp       read / submit (locks) the guest's RSVP
  edit-request.js    POST /api/edit-request   guest asks to reopen a locked RSVP
  admin/login.js     POST /api/admin/login    checks ADMIN_PASSWORD, sets admin cookie
  admin/guests.js    GET/POST/DELETE          list / whitelist / remove guests
  admin/edit-requests.js  GET/POST            list / approve / deny change requests
  admin/export.js    GET /api/admin/export    guest list as CSV download
lib/               ← SERVER-ONLY helpers (imported by api/, never shipped to browser)
  db.js              Vercel Postgres client
  auth.js            HMAC-signed httpOnly session cookies
db/schema.sql      ← run ONCE to create the tables
.env.example       ← the env vars you must set
```

**Security model (do not break it):** the browser never talks to the database. The guest
list and all secrets live server-side. The phone number is the guest credential; `/api/verify`
is rate-limited and returns an identical generic failure for both "unknown number" and
"too many attempts", so it never leaks who is on the list. The admin password is checked only
in `api/admin/login.js` and is never sent to the browser.

---

## Steps

### 1. Push to a Git repo
Create a new GitHub/GitLab repo and push this folder as-is.

### 2. Import the project into Vercel
- vercel.com → **Add New → Project** → import the repo.
- Framework preset: **Other** (there is no build step; it's static + functions).
- Leave build/output settings at their defaults. Deploy once (it will succeed but the
  database isn't connected yet — that's expected).

### 3. Attach Vercel Postgres
- In the project: **Storage → Create Database → Postgres** → create and **Connect** it to
  this project.
- Vercel now **auto-injects** `POSTGRES_URL` and friends into the project's environment.
  You do **not** set these by hand.

### 4. Create the tables
Open **Storage → your database → Query** and paste the contents of **`db/schema.sql`**, then
run it. (Or locally: `psql "$POSTGRES_URL" -f db/schema.sql`.) This creates `guests`,
`rsvps`, and `edit_requests`.

### 5. Set the two secrets you own
Project → **Settings → Environment Variables** → add (for Production, Preview, Development):

| Name             | Value                                                        |
|------------------|--------------------------------------------------------------|
| `ADMIN_PASSWORD` | a strong password for the /admin panel                       |
| `SESSION_SECRET` | a long random string — generate with `openssl rand -hex 32`  |

### 6. Redeploy
Trigger a redeploy (Deployments → ⋯ → Redeploy) so the new env vars + database are live.

### 7. Seed the guest list
Go to **`https://YOUR-DOMAIN/admin`**, sign in with `ADMIN_PASSWORD`, and add guests
(name + phone + language). This is the whitelist — only these numbers can open the invitation.
You can also `INSERT` directly into the `guests` table if you prefer bulk loading.

---

## Verification checklist (do all of these after deploying)

1. **Gate rejects unknown numbers** — open `/`, enter a random number → generic "we couldn't
   find that number" and the card shakes.
2. **Whitelisted number opens** — add yourself in `/admin`, enter that number on `/` → the
   doors open, the envelope rises, and the settled card greets you **by name**.
3. **RSVP submits and locks** — open RSVP, accept with a party size + note, "Seal & send" →
   it flips to a read-only summary. Reload `/` and reopen RSVP → still read-only (locked).
4. **Change request → approve → unlock** — as the guest, "Request a change" with a reason.
   In `/admin`, a change request appears → **Approve & reopen RSVP**. Back as the guest,
   reopen RSVP → it's editable again.
5. **Admin table + CSV** — `/admin` shows totals, per-guest status/party/message, search,
   filter, sort; **Export CSV** downloads the list.
6. **Admin is protected** — open `/admin` in a private window → you get the password screen,
   and hitting `/api/admin/guests` directly returns 401.

If all six pass, it's live. Hand the couple the URL and the `/admin` password.

---

## Local development (optional)
```
npm i -g vercel
npm install
vercel link           # link to the Vercel project (pulls the Postgres env)
vercel env pull .env  # writes the injected POSTGRES_* into .env
# add ADMIN_PASSWORD + SESSION_SECRET to .env (see .env.example)
vercel dev            # http://localhost:3000  (/ and /admin)
```
