# Render Keep-Alive Setup

## The Problem

Render free tier spins down services after **15 minutes of inactivity**. When a new request arrives, the service takes **30-60 seconds** to cold start (boot Node.js, connect to DB, etc.).

## The Solution

Ping the `/health` endpoint every **10 minutes** to prevent spin-down.

## Free External Ping Services

| Service | URL | Min Interval |
|---------|-----|--------------|
| cron-job.org | https://cron-job.org | 1 minute |
| UptimeRobot | https://uptimerobot.com | 5 minutes |
| becron | https://becron.com | 5 minutes |

## Setup Steps (cron-job.org)

1. Create a free account at https://cron-job.org
2. Click **"Create new cron job"**
3. **URL:** `https://<your-service>.onrender.com/health`
4. **Request method:** GET
5. **Execution schedule:** Every 10 minutes
6. **Notification:** (optional) Add your email for downtime alerts

## What the `/health` Endpoint Returns

```json
{ "status": "ok" }
```

- No database query
- No authentication
- No logging overhead
- Minimal overhead for keep-alive pings

## Notes

- The existing `/api/health` endpoint still performs a DB connectivity check and is used for monitoring
- The lightweight `/health` endpoint exists solely to prevent cold starts
- No code changes needed — just configure an external ping service
- Both Vercel and Render handle TLS automatically via Let's Encrypt — no certbot needed
