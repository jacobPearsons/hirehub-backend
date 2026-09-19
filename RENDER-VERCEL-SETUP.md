# HireHub — Render & Vercel Hosting Credentials

Deployment environment variables for hosting HireHub:

- **Backend** → Render (`hirehub-backend`)
- **Frontend** → Vercel (`hirehub-frontend`)

---

## Backend — Render

Set in **Render → Services → hirehub-backend → Environment** (matches `render.yaml`).

| Variable | Example / Value | Notes |
|----------|-----------------|-------|
| `NODE_ENV` | `production` | |
| `PORT` | `10000` | |
| `DATABASE_URL` | `postgresql://user:pass@host:5432/hirehub?schema=public` | Render/Neon/Supabase Postgres connection string |
| `JWT_ACCESS_SECRET` | `<random ≥32 chars>` | `openssl rand -base64 48` |
| `JWT_REFRESH_SECRET` | `<random ≥32 chars>` | different from access secret |
| `CORS_ORIGIN` | `https://hirehub-frontend.vercel.app` | https only; comma-separated multiple origins OK; no localhost/wildcard in prod |
| `APP_URL` | `https://hirehub-frontend.vercel.app` | Frontend URL |
| `RESEND_API_KEY` | `re_xxxxxxxx` | Optional — email sending |
| `CLOUDINARY_CLOUD_NAME` | `your-cloud` | Optional — image uploads |
| `CLOUDINARY_API_KEY` | `xxxxxxxx` | Optional |
| `CLOUDINARY_API_SECRET` | `xxxxxxxx` | Optional |
| `DEMO_BOT_ENABLED` | `false` | Set `true` only for demo mode |
| `SENTRY_DSN` | `https://xxxxx@sentry.io/xxxxx` | Optional — error tracking |

### Render deploy notes

- **Build command:** `npm install && npx prisma generate`
- **Start command:** `npx prisma migrate deploy && npx tsx src/app/server.ts`
- **Health check path:** `/health`
- Repo mount: `hirehub-backend`, branch `feat/demo-mode`

---

## Frontend — Vercel

Set in **Vercel → Project → Settings → Environment Variables** (build-time, prefix `VITE_`).

| Variable | Example / Value | Notes |
|----------|-----------------|-------|
| `VITE_API_URL` | `https://hirehub-backend.onrender.com/api` | Backend API base URL |
| `VITE_EMAILJS_SERVICE_ID` | `service_xxxxx` | Optional — EmailJS |
| `VITE_EMAILJS_TEMPLATE_ID` | `template_xxxxx` | Optional |
| `VITE_EMAILJS_PUBLIC_KEY` | `xxxxx` | Optional |
| `VITE_SENTRY_DSN` | `https://xxxxx@sentry.io/xxxxx` | Optional |

### Vercel notes

- `VITE_*` vars are **public** (embedded in the JS bundle) — never put secrets here.
- After adding vars, trigger a **redeploy** for them to take effect.
- Repo mount: `hirehub-frontend`, branch `main`, framework preset **vite**.

---

## Quick references

- `render.yaml` lives in `hirehub-backend/` (deployment blueprint).
- `FRONTEND_ENV.md` lives in `hirehub-frontend/` (frontend var docs).
- Generate secrets: `openssl rand -base64 48`
- CORS must be https and match the Vercel origin exactly — the backend crashes on `localhost` or `*` in production.