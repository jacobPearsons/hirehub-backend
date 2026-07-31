# Fullstack Environment Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up a fully functional development environment for the HireHub fullstack employment platform with Docker PostgreSQL, and create a reusable skill document for future setups.

**Architecture:** Docker Engine (CLI) runs a PostgreSQL 16 container. The Express/Prisma backend connects to it via `DATABASE_URL`. The React/Vite frontend proxies API calls to the backend. A new skill at `~/.agents/skills/fullstack-environment-setup/SKILL.md` documents the entire process.

**Tech Stack:** Docker Engine, PostgreSQL 16, Express 4, Prisma 5, React 19, Vite 8, TypeScript 6, Bun 1.3, Tailwind CSS 3

## Global Constraints

- Package manager: **bun** (not npm/yarn)
- PostgreSQL via **Docker Engine** (CLI only, no Desktop)
- Docker Compose v2 plugin (bundled with Docker Engine)
- Backend port: **4000**, Frontend port: **5173**, PostgreSQL port: **5432**
- Database name: `hirehub`, user: `postgres`, password: `postgres`
- Project path: `/home/jacobp/Desktop/Projecs/`
- Skill path: `/home/jacobp/.agents/skills/fullstack-environment-setup/`

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `/home/jacobp/Desktop/Projecs/hirehub-backend/docker-compose.yml` | **Create** | PostgreSQL container + backend service orchestration |
| `/home/jacobp/Desktop/Projecs/hirehub-backend/.env` | **Create** | Backend environment variables (DB URL, JWT secrets, CORS) |
| `/home/jacobp/Desktop/Projecs/hirehub-frontend/.env` | **Create** | Frontend environment variables (API URL) |
| `/home/jacobp/.agents/skills/fullstack-environment-setup/SKILL.md` | **Create** | Reusable skill documenting the full setup process |

---

## Task 1: Install Docker Engine + Compose Plugin

**Files:**
- System-level installation (no project files modified)

**Interfaces:**
- Produces: `docker` and `docker compose` CLI commands available to all subsequent tasks

- [ ] **Step 1: Update package lists and install prerequisites**

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl
```

Run: `sudo apt-get update && sudo apt-get install -y ca-certificates curl`
Expected: Packages installed successfully

- [ ] **Step 2: Add Docker's official GPG key**

```bash
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
```

Run: `sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc`
Expected: File created at `/etc/apt/keyrings/docker.asc`

- [ ] **Step 3: Add Docker apt repository**

```bash
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
```

Run: `cat /etc/apt/sources.list.d/docker.list`
Expected: Line containing `deb [arch=amd64 signed-by=...] https://download.docker.com/linux/ubuntu ... stable`

- [ ] **Step 4: Install Docker Engine + Compose plugin**

```bash
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

Run: `sudo apt-get update && sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin`
Expected: Docker Engine and Compose plugin installed

- [ ] **Step 5: Add user to docker group (avoids sudo)**

```bash
sudo usermod -aG docker $USER
newgrp docker
```

Run: `groups $USER`
Expected: Output includes `docker`

- [ ] **Step 6: Verify installation**

```bash
docker --version
docker compose version
```

Run: `docker --version && docker compose version`
Expected:
```
Docker version 2X.X.X, build XXXXXXX
Docker Compose version v2.XX.X
```

- [ ] **Step 7: Commit**

```bash
# No project files changed — system-level install only
```

---

## Task 2: Create docker-compose.yml for PostgreSQL

**Files:**
- Create: `/home/jacobp/Desktop/Projecs/hirehub-backend/docker-compose.yml`

**Interfaces:**
- Produces: A `hirehub-db` PostgreSQL container listening on port 5432
- Produces: A `hirehub-api` backend service (built from existing Dockerfile) on port 4000

- [ ] **Step 1: Write docker-compose.yml**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: hirehub-db
    restart: unless-stopped
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: hirehub
    ports:
      - "5432:5432"
    volumes:
      - hirehub-pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: hirehub-api
    restart: unless-stopped
    ports:
      - "4000:4000"
    depends_on:
      postgres:
        condition: service_healthy
    env_file:
      - .env

volumes:
  hirehub-pgdata:
```

Write to: `/home/jacobp/Desktop/Projecs/hirehub-backend/docker-compose.yml`

- [ ] **Step 2: Verify the file was created correctly**

Run: `cat /home/jacobp/Desktop/Projecs/hirehub-backend/docker-compose.yml | head -5`
Expected: `services:` as first line

Run: `docker compose config` (from hirehub-backend directory)
Expected: Valid YAML output with postgres and backend services defined
Workdir: `/home/jacobp/Desktop/Projecs/hirehub-backend`

- [ ] **Step 3: Commit**

```bash
git add docker-compose.yml
git commit -m "feat: add docker-compose.yml with PostgreSQL 16"
```
Workdir: `/home/jacobp/Desktop/Projecs/hirehub-backend`

---

## Task 3: Create Environment Files

**Files:**
- Create: `/home/jacobp/Desktop/Projecs/hirehub-backend/.env`
- Create: `/home/jacobp/Desktop/Projecs/hirehub-frontend/.env`

**Interfaces:**
- Consumes: None (standalone configuration)
- Produces: Backend connects to PostgreSQL at `localhost:5432/hirehub`
- Produces: Frontend proxies API requests to `localhost:4000`

- [ ] **Step 1: Create backend .env**

```env
PORT=4000
NODE_ENV=development
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/hirehub?schema=public"
JWT_ACCESS_SECRET="hirehub-dev-access-secret-2026-min32chars!!"
JWT_REFRESH_SECRET="hirehub-dev-refresh-secret-2026-min32chars!!"
JWT_ACCESS_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"
CORS_ORIGIN="http://localhost:5173"
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
LOG_LEVEL=info
APP_URL="http://localhost:5173"
RESEND_API_KEY=""
UPLOAD_DIR="uploads"
MAX_FILE_SIZE_MB=10
```

Write to: `/home/jacobp/Desktop/Projecs/hirehub-backend/.env`

- [ ] **Step 2: Create frontend .env**

```env
VITE_API_URL=http://localhost:4000/api
```

Write to: `/home/jacobp/Desktop/Projecs/hirehub-frontend/.env`

- [ ] **Step 3: Verify both files exist**

Run: `ls -la /home/jacobp/Desktop/Projecs/hirehub-backend/.env /home/jacobp/Desktop/Projecs/hirehub-frontend/.env`
Expected: Both files listed

Run: `grep DATABASE_URL /home/jacobp/Desktop/Projecs/hirehub-backend/.env`
Expected: `DATABASE_URL="postgresql://postgres:postgres@localhost:5432/hirehub?schema=public"`

- [ ] **Step 4: Commit**

```bash
echo ".env" >> .gitignore
git add .env .gitignore
git commit -m "feat: add .env with database and JWT configuration"
```
Workdir: `/home/jacobp/Desktop/Projecs/hirehub-backend`

```bash
echo ".env" >> .gitignore
git add .env .gitignore
git commit -m "feat: add .env with API URL configuration"
```
Workdir: `/home/jacobp/Desktop/Projecs/hirehub-frontend`

---

## Task 4: Start PostgreSQL Container

**Files:**
- No file changes (Docker operation only)

**Interfaces:**
- Consumes: `docker-compose.yml` from Task 2
- Produces: PostgreSQL running on `localhost:5432`, database `hirehub` created

- [ ] **Step 1: Pull PostgreSQL image**

```bash
docker pull postgres:16-alpine
```

Run: `docker pull postgres:16-alpine`
Expected: Pull progress bars, eventually `Status: Downloaded newer image for postgres:16-alpine:...`

- [ ] **Step 2: Start PostgreSQL container**

```bash
docker compose up -d postgres
```

Run: `docker compose up -d postgres`
Workdir: `/home/jacobp/Desktop/Projecs/hirehub-backend`
Expected: `Container hirehub-db Started`

- [ ] **Step 3: Verify PostgreSQL is healthy**

```bash
docker compose ps
```

Run: `docker compose ps`
Workdir: `/home/jacobp/Desktop/Projecs/hirehub-backend`
Expected: `hirehub-db` showing status `Up (healthy)`

- [ ] **Step 4: Test connection**

```bash
docker exec hirehub-db psql -U postgres -d hirehub -c "SELECT 1;"
```

Run: `docker exec hirehub-db psql -U postgres -d hirehub -c "SELECT 1;"`
Expected:
```
 ?column?
----------
        1
(1 row)
```

- [ ] **Step 5: Commit**

```bash
# No project files changed — Docker operation only
```

---

## Task 5: Run Prisma Migrations + Generate Client

**Files:**
- No file changes (Prisma generates client into node_modules)

**Interfaces:**
- Consumes: `.env` from Task 3 with `DATABASE_URL`
- Consumes: `prisma/schema.prisma` (existing)
- Produces: Prisma Client generated, database schema applied

- [ ] **Step 1: Install dependencies (if needed)**

```bash
bun install
```

Run: `bun install`
Workdir: `/home/jacobp/Desktop/Projecs/hirehub-backend`
Expected: Packages installed (or already installed message)

- [ ] **Step 2: Generate Prisma Client**

```bash
bun run db:generate
```

Run: `bun run db:generate`
Workdir: `/home/jacobp/Desktop/Projecs/hirehub-backend`
Expected: `Generated Prisma Client` (or similar success message)

- [ ] **Step 3: Push schema to database**

```bash
bun run db:push
```

Run: `bun run db:push`
Workdir: `/home/jacobp/Desktop/Projecs/hirehub-backend`
Expected: `The database is now in sync with your Prisma schema`

- [ ] **Step 4: Verify tables were created**

```bash
docker exec hirehub-db psql -U postgres -d hirehub -c "\dt"
```

Run: `docker exec hirehub-db psql -U postgres -d hirehub -c "\dt"`
Expected: List of tables including `users`, `jobs`, `applications`, `saved_jobs`, `refresh_tokens`, `reset_tokens`, `blog_posts`, `contact_submissions`, `pricing_tiers`

- [ ] **Step 5: Commit**

```bash
# No project files changed — generated artifacts only
```

---

## Task 6: Start Backend Server

**Files:**
- No file changes (runtime operation)

**Interfaces:**
- Consumes: PostgreSQL from Task 4
- Consumes: `.env` from Task 3
- Consumes: Prisma Client from Task 5
- Produces: Express API running on `http://localhost:4000`

- [ ] **Step 1: Start backend dev server**

```bash
bun run dev
```

Run: `bun run dev`
Workdir: `/home/jacobp/Desktop/Projecs/hirehub-backend`
Expected: Log output showing `Server started` with port 4000

- [ ] **Step 2: Test health endpoint (in a separate terminal)**

```bash
curl -s http://localhost:4000/api/health || curl -s http://localhost:4000/health
```

Run: `curl -s http://localhost:4000/api/health`
Expected: JSON response (may be `{"status":"ok"}` or similar — exact response depends on backend implementation)

- [ ] **Step 3: Test Swagger docs**

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:4000/api-docs
```

Run: `curl -s -o /dev/null -w "%{http_code}" http://localhost:4000/api-docs`
Expected: `200`

- [ ] **Step 4: Commit**

```bash
# No project files changed — runtime operation only
```

---

## Task 7: Start Frontend Dev Server

**Files:**
- No file changes (runtime operation)

**Interfaces:**
- Consumes: `.env` from Task 3 with `VITE_API_URL`
- Consumes: Backend running from Task 6
- Produces: Vite dev server running on `http://localhost:5173`

- [ ] **Step 1: Install frontend dependencies (if needed)**

```bash
bun install
```

Run: `bun install`
Workdir: `/home/jacobp/Desktop/Projecs/hirehub-frontend`
Expected: Packages installed

- [ ] **Step 2: Start frontend dev server**

```bash
bun run dev
```

Run: `bun run dev`
Workdir: `/home/jacobp/Desktop/Projecs/hirehub-frontend`
Expected: Vite output showing `Local: http://localhost:5173/`

- [ ] **Step 3: Test frontend loads**

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:5173
```

Run: `curl -s -o /dev/null -w "%{http_code}" http://localhost:5173`
Expected: `200`

- [ ] **Step 4: Test API proxy works**

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/api/health
```

Run: `curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/api/health`
Expected: `200` (Vite proxies to backend)

- [ ] **Step 5: Commit**

```bash
# No project files changed — runtime operation only
```

---

## Task 8: Create the Skill Document

**Files:**
- Create: `/home/jacobp/.agents/skills/fullstack-environment-setup/SKILL.md`

**Interfaces:**
- Consumes: All tasks above (documents the full process)
- Produces: Reusable skill for future fullstack environment setups

- [ ] **Step 1: Create skill directory**

```bash
mkdir -p /home/jacobp/.agents/skills/fullstack-environment-setup
```

Run: `ls -la /home/jacobp/.agents/skills/fullstack-environment-setup/`
Expected: Directory exists

- [ ] **Step 2: Write SKILL.md**

Write the full skill document to `/home/jacobp/.agents/skills/fullstack-environment-setup/SKILL.md` with:

```markdown
---
name: fullstack-environment-setup
description: Use when setting up a fullstack employment/hiring platform development environment with Docker PostgreSQL, Express, Prisma, React, Vite, and Bun
---

# Fullstack Environment Setup

## Overview

Set up a fully functional development environment for a fullstack employment/hiring platform. Docker Engine runs PostgreSQL. Express/Prisma backend connects to it. React/Vite frontend proxies API calls. All commands use **bun** as the package manager.

## Prerequisites

| Tool | Min Version | Install |
|------|-------------|---------|
| Bun | 1.0+ | `curl -fsSL https://bun.sh/install \| bash` |
| Node.js | 20+ | Comes with Bun |
| Docker Engine | 24+ | See Task 1 below |

## Quick Start

```bash
# 1. Install Docker Engine (one-time)
sudo apt-get update && sudo apt-get install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER && newgrp docker

# 2. Start PostgreSQL
cd hirehub-backend
docker compose up -d postgres
docker compose ps  # verify healthy

# 3. Configure environment
cp .env.example .env  # edit as needed

# 4. Run migrations
bun run db:generate
bun run db:push

# 5. Start backend (terminal 1)
bun run dev

# 6. Start frontend (terminal 2)
cd ../hirehub-frontend
bun run dev
```

## Architecture

```dot
digraph arch {
    rankdir=LR;
    node [shape=box, style=filled];

    frontend [label="React + Vite\n:5173" fillcolor="#dbeafe"];
    backend [label="Express + Prisma\n:4000" fillcolor="#d4edda"];
    postgres [label="PostgreSQL 16\nDocker\n:5432" fillcolor="#f8d7da"];

    frontend -> backend [label="/api proxy"];
    backend -> postgres [label="DATABASE_URL"];
}
```

## Docker Compose Services

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| `postgres` | `postgres:16-alpine` | 5432 | Database with health check, persistent volume |
| `backend` | Built from `./Dockerfile` | 4000 | Express API (production mode) |

## Environment Variables

### Backend (.env)

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `4000` | Express server port |
| `NODE_ENV` | `development` | Environment mode |
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/hirehub?schema=public` | PostgreSQL connection string |
| `JWT_ACCESS_SECRET` | (set in .env) | Min 32 chars, access token signing |
| `JWT_REFRESH_SECRET` | (set in .env) | Min 32 chars, refresh token signing |
| `JWT_ACCESS_EXPIRES_IN` | `15m` | Access token TTL |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | Refresh token TTL |
| `CORS_ORIGIN` | `http://localhost:5173` | Allowed origin for CORS |
| `RESEND_API_KEY` | (empty) | Email service key (optional) |

### Frontend (.env)

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `http://localhost:4000/api` | Backend API base URL |

## Common Commands Reference

```bash
# Database
docker compose up -d postgres          # Start PostgreSQL
docker compose down                     # Stop all containers
docker compose ps                       # Check container status
bun run db:generate                     # Generate Prisma Client
bun run db:push                         # Push schema to DB
bun run db:migrate                      # Create migration
bun run db:studio                       # Open Prisma Studio (GUI)

# Backend
bun run dev                             # Start dev server with hot reload
bun run build                           # Build for production
bun run start                           # Run production build
bun run test                            # Run tests

# Frontend
bun run dev                             # Start Vite dev server
bun run build                           # Build for production
bun run preview                         # Preview production build
```

## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| `permission denied while trying to connect to Docker daemon` | User not in docker group | `sudo usermod -aG docker $USER && newgrp docker` |
| `connect ECONNREFUSED 127.0.0.1:5432` | PostgreSQL container not running | `docker compose up -d postgres && docker compose ps` |
| `P1001: Can't reach database server` | Prisma can't connect | Check `DATABASE_URL` in `.env` matches docker-compose credentials |
| `Error: listen EADDRINUSE:4000` | Port 4000 already in use | `lsof -i :4000` to find process, kill it or change PORT |
| `Error: listen EADDRINUSE:5173` | Port 5173 already in use | `lsof -i :5173` to find process, kill it |
| `docker: command not found` | Docker not installed | Follow Task 1 installation steps |
| `No container found` | Container stopped | `docker compose up -d postgres` |
| Prisma migration fails | DB not ready | Wait for health check, then `bun run db:push` |

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Using `npm` instead of `bun` | Always use `bun install`, `bun run dev`, etc. |
| Forgetting to start PostgreSQL first | Always `docker compose up -d postgres` before backend |
| Missing `.env` file | Copy from `.env.example` and fill in JWT secrets |
| JWT secrets too short | Minimum 32 characters for security |
| Running backend without `db:generate` | Always `bun run db:generate` after schema changes |
```

Write to: `/home/jacobp/.agents/skills/fullstack-environment-setup/SKILL.md`

- [ ] **Step 3: Verify skill was created**

Run: `ls -la /home/jacobp/.agents/skills/fullstack-environment-setup/SKILL.md`
Expected: File exists

Run: `head -5 /home/jacobp/.agents/skills/fullstack-environment-setup/SKILL.md`
Expected: Starts with `---`

- [ ] **Step 4: Commit**

```bash
# Skill is outside git repos — no commit needed
```

---

## Verification Checklist

After all tasks complete, verify the full stack:

1. `docker compose ps` — shows `hirehub-db` healthy and `hirehub-api` running (if backend container started)
2. `curl -s http://localhost:4000/api-docs` — returns 200
3. `curl -s http://localhost:5173` — returns 200
4. `curl -s http://localhost:5173/api/health` — returns 200 (proxy working)
5. `docker exec hirehub-db psql -U postgres -d hirehub -c "\dt"` — shows all tables
6. Skill exists at `/home/jacobp/.agents/skills/fullstack-environment-setup/SKILL.md`
