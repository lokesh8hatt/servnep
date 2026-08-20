# Deploying ServeNep for free

Three free services, one each for database, backend, and frontend:

| Layer | Service | Why |
|---|---|---|
| Postgres | [Neon](https://neon.tech) | Free tier has no expiry (Render's free Postgres is deleted after 90 days) |
| Backend (NestJS) | [Render](https://render.com) | Free web service, deploys straight from the Dockerfile already in this repo |
| Frontend (Next.js) | [Vercel](https://vercel.com) | Built for Next.js, no cold starts, generous free tier |

All three offer "Continue with GitHub" sign-up, so use the same GitHub account you pushed this repo with.

**The one real tradeoff**: Render's free web service spins down after ~15 minutes of no traffic. The first request after that takes 30–60s to wake back up. Fine for a demo/portfolio link; noticeable if you're actively clicking around after a break.

---

## 1. Database — Neon

1. Sign up at [neon.tech](https://neon.tech) with GitHub.
2. Create a project (any name/region — pick one close to Nepal if offered, e.g. Singapore).
3. On the project dashboard, click **Connect** and copy the connection string. It looks like:
   ```
   postgresql://user:password@ep-xxxx.region.aws.neon.tech/neondb?sslmode=require
   ```
4. Keep this tab open — you'll paste this string into Render in step 2, and use it locally in step 4 to seed the database.

## 2. Backend — Render

1. Sign up at [render.com](https://render.com) with GitHub, and grant it access to this repo.
2. **New > Blueprint**, select this repo. Render will detect `render.yaml` at the repo root and propose one service: `servenep-backend`.
3. It will prompt for two values it can't auto-fill (marked `sync: false` in the blueprint):
   - `DATABASE_URL` → paste the Neon connection string from step 1.
   - `CORS_ORIGIN` → leave as a placeholder for now (e.g. `http://localhost:3000`) — you'll update it in step 3 once you have the real Vercel URL.
4. Deploy. First build takes a few minutes (it's building the Dockerfile). Once live, note the backend's URL, e.g. `https://servenep-backend.onrender.com`.
5. Sanity check: open `https://servenep-backend.onrender.com/api/v1/services` in a browser — should return `[]` (empty array; no services seeded yet) rather than an error.

`DB_SYNCHRONIZE=true` is set in the blueprint, so the database schema (all tables) gets created automatically on first boot — no manual migration step needed.

`DEMO_MODE=true` is also set in the blueprint. Without it, the login page's one-click demo buttons return a 403 in production (they're hardcoded off unless explicitly re-enabled) — this deployment has no real SMS gateway, so that's the only way to log in at all. Leave it out entirely if you ever deploy this for real users instead of a demo.

## 3. Seed the database

Run this from your own machine, pointed at the live Neon database (nothing here touches Render or Vercel):

```bash
cd backend
DATABASE_URL="postgresql://user:password@ep-xxxx.region.aws.neon.tech/neondb?sslmode=require" npm run seed
```

(On Windows PowerShell: `$env:DATABASE_URL="..."; npm run seed`)

This creates the service catalog and the three demo accounts (customer/technician/admin) that the login page's one-click buttons use.

## 4. Frontend — Vercel

1. Sign up at [vercel.com](https://vercel.com) with GitHub.
2. **Add New > Project**, import this repo.
3. Set **Root Directory** to `frontend` (important — this is a monorepo with backend alongside it).
4. Under **Environment Variables**, add:
   - `NEXT_PUBLIC_API_URL` = `https://servenep-backend.onrender.com/api/v1` (your actual Render URL from step 2, with `/api/v1` appended)
5. Deploy. Note the resulting URL, e.g. `https://servenep.vercel.app`.

## 5. Close the loop: update CORS

Go back to the Render dashboard → `servenep-backend` → **Environment**, and set:
```
CORS_ORIGIN=https://servenep.vercel.app
```
(your actual Vercel URL from step 4). Save — Render redeploys automatically. Without this, the browser will block every API request from the deployed frontend with a CORS error, even though the backend itself is reachable.

## 6. Verify

Visit your Vercel URL and check:
- Homepage loads, service categories show real counts (confirms the frontend reached the backend and Neon has data)
- Login page → one-click demo login for each role → lands on the right dashboard
- Book a service end-to-end as the demo customer
- Dark mode toggle, sound toggle, toast notifications all work
- "Invoice" button on the customer dashboard opens a formatted invoice in a new tab

---

## Redeploying after a change

Use `scripts/deploy-backend.sh` and `scripts/deploy-frontend.sh` rather than
triggering deploys by hand. They push to `origin/main` first and then verify
the commit that actually went live matches — a plain "trigger a Render
deploy" call has no way to notice if your local commits were never pushed,
and will happily redeploy stale code with no error. `deploy-backend.sh`
needs `RENDER_API_KEY` set; `deploy-frontend.sh` needs the Vercel CLI logged
in (`vercel login`).

## Notes for later

- **`DB_SYNCHRONIZE=true` in production** is a deliberate demo-scope tradeoff — there's no migration system, so this lets TypeORM create/adjust tables automatically. Once you have real data you care about, set it to `false` in Render's environment settings and introduce proper TypeORM migrations before making further schema changes.
- **eSewa/Khalti payments** are wired to their sandbox/test endpoints with placeholder keys — real transactions won't process. Fine for a demo; would need real merchant credentials for production use.
- **Cold starts**: if the 30–60s wake-up on Render's free tier becomes annoying, Render's paid tier removes it, or you could move the backend to Fly.io's free allowance instead (no sleep, more setup).
