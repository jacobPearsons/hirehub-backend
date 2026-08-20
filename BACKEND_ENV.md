# HireHub Backend — Environment Variables

## Required

| Variable | Example | Notes |
|----------|---------|-------|
| `DATABASE_URL` | `postgresql://user:pass@host:5432/dbname` | Neon / Supabase / any Postgres |
| `JWT_ACCESS_SECRET` | `my1yGlS+0tEMvbYcKhZB+aOQ1biD0WoxL3P/VKD6hYnX0rhalIgwTm9n0W+QMqDk` | At least 32 characters |
| `JWT_REFRESH_SECRET` | `MYL5IO2Pcq0Mzi9XAhCAc90Di9OthY+ORwpreMrM7W/An4vt7ZYNR+X935tdtvrt` | At least 32 characters |

## Render Deployment

| Variable | Value | Notes |
|----------|-------|-------|
| `PORT` | `10000` | Render assigns this, but set it anyway |
| `NODE_ENV` | `production` | Enables strict CORS checks |
| `CORS_ORIGIN` | `https://your-frontend.vercel.app` | Your Vercel frontend URL |

## Optional — Email (Resend)

| Variable | Value | Notes |
|----------|-------|-------|
| `RESEND_API_KEY` | `re_xxxxx` | Transactional emails |
| `APP_URL` | `https://your-frontend.vercel.app` | Links in emails |

## Optional — Uploads (Cloudinary)

| Variable | Value | Notes |
|----------|-------|-------|
| `CLOUDINARY_CLOUD_NAME` | `xxxxx` | Logo/avatar uploads |
| `CLOUDINARY_API_KEY` | `xxxxx` | |
| `CLOUDINARY_API_SECRET` | `xxxxx` | |

## Optional — Monitoring

| Variable | Value | Notes |
|----------|-------|-------|
| `SENTRY_DSN` | `https://xxxxx@sentry.io/xxxxx` | Error tracking |
| `LOG_LEVEL` | `info` | `fatal` `error` `warn` `info` `debug` `trace` |

## Optional — Demo Bot

| Variable | Value | Notes |
|----------|-------|-------|
| `DEMO_BOT_ENABLED` | `true` | Auto-replies in demo mode |

## Defaults (safe to omit)

| Variable | Default |
|----------|---------|
| `JWT_ACCESS_EXPIRES_IN` | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | `7d` |
| `RATE_LIMIT_WINDOW_MS` | `900000` (15 min) |
| `RATE_LIMIT_MAX` | `100` |
| `UPLOAD_DIR` | `uploads` |
| `MAX_FILE_SIZE_MB` | `10` |
