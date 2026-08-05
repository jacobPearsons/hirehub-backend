# HireHub Backend — Application RBAC Permissions (`requirePermission` adoption)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the two confirmed E2E breaks and adopt `requirePermission` RBAC for real, so an ADMIN can grant an employer granular permission to act on applications:

1. `GET /api/applications` returns 400 for EMPLOYERs who call it without a `jobId` (the frontend `ApplicationsContext.listApplications()` does exactly this). Fixed on the frontend by branching to `GET /api/applications/employer/me` (frontend plan); this backend plan does NOT change `list()`.
2. `PATCH /api/applications/:id/status` is ADMIN-only → employer pipeline mutations 403. This plan makes status changes require `application:update` permission (ADMIN always allowed via a short-circuit; employers allowed only when granted).
3. Expose effective RBAC permissions in auth responses (`register`/`login`/`getMe`) so the frontend can gate UI per-user.
4. Gate the public RBAC read routes (`GET /roles`, `GET /roles/:id`).
5. Seed the RBAC roles in `src/prisma/seed.ts` (fresh DBs currently get zero roles).

**Architecture:** The backend becomes permission-aware on the applications routes via `requirePermission(action)`, which pre-checks `req.user` then `evaluatePermission(userId, action)` over active role bindings, with an ADMIN short-circuit. `updateHiringData` (interview/offer/preboarding/orientation) gains an EMPLOYER branch (SEEKER self-service + ADMIN unchanged) that requires `application:update` AND job ownership in the service layer.

## Global Constraints

- Repo: `hirehub-backend`, branch `feat/onboarding-wizard`. Commit directly; never create/switch branches, never worktree.
- **Never run `git add -A` / `git add .`** — the working tree contains pre-existing uncommitted agent artifacts (modified source files, untracked migrations/scripts, modified test files). Stage only the exact files each task names.
- Verify from `hirehub-backend/`: `npm test` (vitest run), `npx tsc --noEmit`.
- Tests run against `hirehub` DB (`postgresql://postgres:postgres@localhost:5432/hirehub?schema=public` in `.env.test`). Tests clean up after themselves; role rows they create must be deleted in `afterAll`.
- Wire statuses are UPPERCASE (`APPLIED`, `REVIEWING`, `INTERVIEWING`, `REJECTED`, `OFFER`).
- Authorization errors are 403 (`AuthorizationError`), missing tokens 401 (`AuthenticationError`), missing records 404 (`NotFoundError`).
- `applications.service.ts` and `auth.service.ts` have **pre-existing uncommitted changes** (e.g., the `notificationsService` call in `updateStatus`). Preserve them; only touch the lines each task names.
- `requirePermission` is async and **throws** (does not call `next(err)`), so it must come AFTER `requireAuth` in every route chain.
- `req.user` = `{ userId, role }` from JWT; roles/permissions are never refreshed within a request. Permission checks hit the DB per request.
- The `Role`/`RoleBinding` models exist in `prisma/schema.prisma` (migration `20260729174113_add_rbac_and_audit`); the seed gap is that `src/prisma/seed.ts` does NOT seed roles while root `prisma/seed.ts` does.
- Test conventions (`src/tests/setup.ts` connects the DB in global `beforeAll`): register via `POST /api/auth/register`, promote to ADMIN via `prisma.user.update`, token from `res.body.data.accessToken`, cleanup via `prisma.user.deleteMany({ where: { email: { in: emails } } })`. `applications-hiring-flow.test.ts` already follows this (see its helper `register`).
- The existing test `forbids the owning EMPLOYER from updating status` (403) must KEEP passing: an ungranted employer has no `application:update` binding → DENY at the route.

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/middleware/permission.ts` | Modify | ADMIN short-circuit in `requirePermission` |
| `src/modules/applications/applications.routes.ts` | Modify | status route → `requirePermission('application:update')` |
| `src/modules/applications/applications.service.ts` | Modify | `updateStatus` ownership guard; `updateHiringData` EMPLOYER branch |
| `src/modules/auth/auth.service.ts` | Modify | `getEffectivePermissions` + `permissions` in register/login/getMe |
| `src/modules/rbac/rbac.routes.ts` | Modify | gate `GET /roles` + `GET /roles/:id` to ADMIN |
| `src/prisma/seed.ts` | Modify | seed `admin`/`employer`/`seeker` role rows |
| `src/tests/applications-hiring-flow.test.ts` | Modify | granted-employer integration cases |
| `src/tests/rbac-gating.test.ts` | Create | role read routes 401/403/200 |
| `src/tests/auth-permissions.test.ts` | Create | `permissions` in login/getMe + bindings |

---

### Task A1: ADMIN short-circuit in `requirePermission`

**Files:**
- Modify: `src/middleware/permission.ts`

**Why:** `evaluatePermission` has no implicit ADMIN — an ADMIN with no `RoleBinding` rows gets DENY. The existing `applications-hiring-flow.test.ts` ADMIN cases (status + hiring-data 200) must keep passing, and admins are the granters who must always act.

**Interfaces:**
- Consumes: `evaluatePermission` from `../modules/rbac/permission-evaluator`, `AuthorizationError`.
- Produces: unchanged signature `requirePermission(action: string)`; ADMIN (by JWT `role`) short-circuits to `next()`.

- [ ] **Step 1: Change the code.** After the `req.user` guard, insert:
  ```ts
  if (req.user.role === 'ADMIN') {
    return next()
  }
  ```
  Resulting function body:
  ```ts
  export function requirePermission(action: string) {
    return async (req: Request, _res: Response, next: NextFunction) => {
      if (!req.user) {
        throw new AuthorizationError('Authentication required')
      }

      if (req.user.role === 'ADMIN') {
        return next()
      }

      const result = await evaluatePermission(req.user.userId, action)

      if (result.decision === 'DENY') {
        throw new AuthorizationError(`Insufficient permissions: ${result.reason}`)
      }

      next()
    }
  }
  ```
  Do not touch anything else in the file.
- [ ] **Step 2: Verify.** `npx tsc --noEmit` clean; `npm test` — the existing `allows ADMIN to update status` and `allows ADMIN to update hiring data` cases in `applications-hiring-flow.test.ts` still pass (ADMIN short-circuit). Note: this task alone is safe because no route uses `requirePermission` yet.
- [ ] **Step 3: Commit.** `git add src/middleware/permission.ts`; message `feat(rbac): short-circuit requirePermission for ADMIN role`.

---

### Task A2: Status route requires `application:update`

**Files:**
- Modify: `src/modules/applications/applications.routes.ts`

**Interfaces:**
- Consumes: `requirePermission` from `../../middleware/permission` (new import).
- Produces: `PATCH /api/applications/:id/status` chain becomes `requireAuth, requirePermission('application:update'), validate(updateStatusSchema)`. `validate` stays AFTER the permission check so ungranted callers get 403 before body validation.

- [ ] **Step 1: Change the code.**
  - Add import at top (after the `requireRole` import line 2):
    ```ts
    import { requirePermission } from '../../middleware/permission'
    ```
  - Replace line 29:
    ```ts
    router.patch('/applications/:id/status', requireAuth, requirePermission('application:update'), validate(updateStatusSchema), applicationsController.updateStatus)
    ```
  - Do NOT touch `hiring-data` (line 30) here — it is Task A3's service-side responsibility (route stays `requireAuth` so SEEKER self-service works).
- [ ] **Step 2: Verify.** `npx tsc --noEmit` clean; `npm test` — the existing 403 status cases for owning/non-owning employer and seeker still pass (DENY because no bindings), ADMIN 200 passes (short-circuit).
- [ ] **Step 3: Commit.** `git add src/modules/applications/applications.routes.ts`; message `feat(rbac): require application:update on application status route`.

---

### Task A3: Service guards — job ownership + EMPLOYER hiring-data branch

**Files:**
- Modify: `src/modules/applications/applications.service.ts`

**Interfaces:**
- Consumes: `evaluatePermission` from `../rbac/permission-evaluator` (new import).
- `updateStatus(id, status, userId, userRole)` — the route already enforced `application:update`; the service adds **job ownership**: non-ADMIN callers must own the application's job. Ungranted callers never reach the service (route DENY).
- `updateHiringData(userId, applicationId, data, userRole)` — SEEKER path unchanged (own-application check); new EMPLOYER path requires `evaluatePermission(userId, 'application:update')` ALLOW **and** own-job; ADMIN unchanged. Any other role → 403.
- `application.job` is available (the existing `getCandidate` already reads `application.job.employerId`, so `repo.findById` includes `job` with `employerId`).
- Preserve the `(id, status, userId, userRole)` and `(userId, applicationId, data, userRole)` signatures — no controller churn.

- [ ] **Step 1: Change the code.**
  - Add import (after line 6 `notificationsService` import):
    ```ts
    import { evaluatePermission } from '../rbac/permission-evaluator'
    ```
  - **`updateStatus` guard** (lines 43-48): replace the body between the `findById` NotFound check and the `repo.updateStatus` call:
    ```ts
    if (userRole !== 'ADMIN' && application.job.employerId !== userId) {
      throw new AuthorizationError('Not authorized to update this application')
    }
    ```
    Remove the old `if (userRole !== 'ADMIN') throw new AuthorizationError('Only admins can update application status')`.
  - **`updateHiringData` guard** (lines 102-108): replace with:
    ```ts
    if (userRole === 'SEEKER') {
      if (application.userId !== userId) {
        throw new AuthorizationError('Not authorized to update this application')
      }
    } else if (userRole === 'EMPLOYER') {
      const result = await evaluatePermission(userId, 'application:update')
      if (result.decision === 'DENY' || application.job.employerId !== userId) {
        throw new AuthorizationError('Not authorized to update this application')
      }
    } else if (userRole !== 'ADMIN') {
      throw new AuthorizationError('Not authorized to update this application')
    }
    ```
  - Do not touch anything else in the file (preserve the `notificationsService` block in `updateStatus`).
- [ ] **Step 2: Verify.** `npx tsc --noEmit` clean; `npm test` — existing cases: ADMIN status 200, owning/other employer status 403, seeker status 403, unauth 401; hiring-data ADMIN 200, owning/other employer 403, seeker 200, unauth 401.
- [ ] **Step 3: Commit.** `git add src/modules/applications/applications.service.ts`; message `feat(rbac): enforce job ownership and permission in application service`.

---

### Task A4: Auth responses expose effective permissions

**Files:**
- Modify: `src/modules/auth/auth.service.ts`

**Interfaces:**
- New private method `getEffectivePermissions(user: { id: string; role: string }): Promise<string[]>`:
  - ADMIN → `['*:*']` (no DB call).
  - Otherwise → union of `capabilities` (JSON `string[]`) across all `roleBinding` rows where `userId`, `status: 'active'`, and (`expiresAt` null OR in the future), `include: { role: true }`. Return a de-duplicated array (Set).
- `register`: inside the `$transaction` result, compute `permissions` (via `getEffectivePermissions(user)` on the created user — a fresh user has no bindings, so non-ADMINs get `[]`; ADMINs get `['*:*']`) and return `user: { ...user, permissions }`. Note `USER_SELECT` does not include `permissions`, so the spread is additive.
- `login`: after `userWithoutPassword`, compute `permissions` and return `user: { ...userWithoutPassword, permissions }`.
- `getMe`: compute `permissions` and return `{ ...user, permissions }`.
- All three produce the same shape: the user object gains a `permissions: string[]` field. Nothing else changes.

- [ ] **Step 1: Change the code.**
  - Add the method after `getMe` (or near it):
    ```ts
    private async getEffectivePermissions(user: { id: string; role: string }): Promise<string[]> {
      if (user.role === 'ADMIN') return ['*:*']

      const bindings = await prisma.roleBinding.findMany({
        where: {
          userId: user.id,
          status: 'active',
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        include: { role: true },
      })

      const permissions = new Set<string>()
      for (const binding of bindings) {
        for (const capability of (binding.role.capabilities as string[]) ?? []) {
          permissions.add(capability)
        }
      }
      return [...permissions]
    }
    ```
  - **register** return (line 60): `return { user: { ...user, permissions: await this.getEffectivePermissions(user) }, accessToken, refreshToken }`
  - **login** return (lines 82-83):
    ```ts
    const { passwordHash: _, ...userWithoutPassword } = user
    const permissions = await this.getEffectivePermissions(user)
    return { user: { ...userWithoutPassword, permissions }, accessToken, refreshToken }
    ```
  - **getMe** (lines 115-122):
    ```ts
    async getMe(userId: string) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: USER_SELECT,
      })
      if (!user) throw new NotFoundError('User')
      const permissions = await this.getEffectivePermissions(user)
      return { ...user, permissions }
    }
    ```
  - Do not touch the other auth methods.
- [ ] **Step 2: Verify.** `npx tsc --noEmit` clean; `npm test` — existing auth/applications tests must remain green (the extra `permissions` field is additive).
- [ ] **Step 3: Commit.** `git add src/modules/auth/auth.service.ts`; message `feat(auth): expose effective RBAC permissions in register/login/getMe`.

---

### Task A5: Gate RBAC read routes to ADMIN

**Files:**
- Modify: `src/modules/rbac/rbac.routes.ts`

**Interfaces:**
- Consumes: existing `requireAuth`, `requireRole` (already imported).
- `GET /roles` and `GET /roles/:id` become `requireAuth, requireRole('ADMIN')`. Mutations are already ADMIN-gated. `GET /roles/bindings` is already gated and MUST stay defined BEFORE `/roles/:id` (Express matches in order; `/roles/bindings` would otherwise be swallowed by `:id`).
- Role lookups return the raw role rows (`capabilities: string[]`); ADMIN UI (frontend plan) uses these.

- [ ] **Step 1: Change the code.** Replace lines 29 and 31:
  ```ts
  router.get('/roles', requireAuth, requireRole('ADMIN'), rbacController.listRoles)
  router.get('/roles/bindings', requireAuth, requireRole('ADMIN'), rbacController.listBindings)
  router.get('/roles/:id', requireAuth, requireRole('ADMIN'), rbacController.getRoleById)
  ```
  (i.e., add the two middlewares to the existing `GET /roles` and `GET /roles/:id` lines; keep `/roles/bindings` line as-is and in place.)
- [ ] **Step 2: Verify.** `npx tsc --noEmit` clean; `npm test` — no existing test hits `/roles`, so this is green; full gating coverage lands in Task A7's `rbac-gating.test.ts`.
- [ ] **Step 3: Commit.** `git add src/modules/rbac/rbac.routes.ts`; message `feat(rbac): gate role read routes to ADMIN`.

---

### Task A6: Seed RBAC roles in `src/prisma/seed.ts`

**Files:**
- Modify: `src/prisma/seed.ts`

**Why:** `npm run db:seed` runs `src/prisma/seed.ts`, which never creates roles. On a fresh DB the `roles` table is empty → `evaluatePermission` returns DENY for everyone (even granted bindings are impossible), and the admin grant UI (frontend plan) has nothing to list. Root `prisma/seed.ts` already seeds these roles; mirror it here.

**Interfaces:**
- Role rows mirror root `prisma/seed.ts` exactly:
  - `admin` → capabilities `['*:*']`
  - `employer` → `['job:create','job:read','job:update','job:delete','job:list','application:read','application:update','application:list','user:read']`
  - `seeker` → `['job:read','job:list','application:create','application:read','application:delete','application:list','user:read','user:update']`
- Use `prisma.role.upsert` keyed on `id` so re-seeding is idempotent.

- [ ] **Step 1: Change the code.**
  - Add a `defaultRoles` constant near the top (after `SALT_ROUNDS`, before `main()`):
    ```ts
    const defaultRoles = [
      {
        id: 'admin',
        name: 'Administrator',
        description: 'Full system access with all capabilities',
        capabilities: ['*:*'],
      },
      {
        id: 'employer',
        name: 'Employer',
        description: 'Can manage job listings and review applications',
        capabilities: [
          'job:create', 'job:read', 'job:update', 'job:delete', 'job:list',
          'application:read', 'application:update', 'application:list',
          'user:read',
        ],
      },
      {
        id: 'seeker',
        name: 'Job Seeker',
        description: 'Can search jobs and submit applications',
        capabilities: [
          'job:read', 'job:list',
          'application:create', 'application:read', 'application:delete', 'application:list',
          'user:read', 'user:update',
        ],
      },
    ]
    ```
  - At the start of `main()`, right after the `// Clear existing data` block (roles have no FK dependencies; `role_bindings` cascade-delete with users), add:
    ```ts
    for (const role of defaultRoles) {
      await prisma.role.upsert({
        where: { id: role.id },
        update: { name: role.name, description: role.description, capabilities: role.capabilities },
        create: role,
      })
    }
    console.log(`  ✓ Seeded ${defaultRoles.length} RBAC roles`)
    ```
  - Do not touch the rest of the seed file.
- [ ] **Step 2: Verify.** `npx tsc --noEmit` clean. If a local Postgres is running, optionally `npm run db:seed` and confirm roles exist — but do NOT run it if it would clobber a dev DB you care about (the seed deletes users/jobs). At minimum confirm the file type-checks.
- [ ] **Step 3: Commit.** `git add src/prisma/seed.ts`; message `fix(seed): seed RBAC roles in src/prisma seed`.

---

### Task A7: Tests — granted-employer integration + role gating + auth permissions

**Files:**
- Modify: `src/tests/applications-hiring-flow.test.ts`
- Create: `src/tests/rbac-gating.test.ts`
- Create: `src/tests/auth-permissions.test.ts`

**Interfaces:**
- The existing `applications-hiring-flow.test.ts` cases stay as-is (they must still pass): ADMIN status 200, owning/other employer status 403, seeker 403, unauth 401; hiring-data ADMIN 200, owning/other employer 403, seeker 200, unauth 401; candidate GET cases unchanged.
- Add a **self-contained** granted-employer describe block: it creates its own job + application so "owning" vs "non-owning" is unambiguous, and it creates its own role + bindings via `prisma` (robust regardless of seed state in the shared `hirehub` DB).
- Because the test DB is the shared `hirehub` DB, every created role/binding/user MUST be deleted in `afterAll`.

**`applications-hiring-flow.test.ts` — new describe block (appended inside the outer `describe`):**

```ts
describe('Applications granted employer (application:update)', () => {
  const TEST_ROLE_ID = 'test-employer-applications'
  let grantedToken = ''
  let grantedOtherToken = ''
  let grantedSeekerToken = ''
  let grantedJobId = ''
  let grantedApplicationId = ''

  async function registerWithId(name: string, role: string, prefix: string) {
    const token = await register(name, role, prefix)
    const email = emails[emails.length - 1]
    const user = await prisma.user.findUnique({ where: { email } })
    return { token, userId: user!.id }
  }

  beforeAll(async () => {
    await prisma.role.upsert({
      where: { id: TEST_ROLE_ID },
      update: { capabilities: ['application:update'] },
      create: {
        id: TEST_ROLE_ID,
        name: 'Test Employer (Applications)',
        description: '',
        capabilities: ['application:update'],
      },
    })

    const owner = await registerWithId('Granted Owner', 'EMPLOYER', 'granted-owner')
    const other = await registerWithId('Granted Other', 'EMPLOYER', 'granted-other')
    const seeker = await registerWithId('Granted Seeker', 'SEEKER', 'granted-seeker')
    grantedToken = owner.token
    grantedOtherToken = other.token
    grantedSeekerToken = seeker.token

    await prisma.roleBinding.createMany({
      data: [
        { userId: owner.userId, roleId: TEST_ROLE_ID, contextType: 'global' },
        { userId: other.userId, roleId: TEST_ROLE_ID, contextType: 'global' },
      ],
    })

    const jobRes = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${grantedToken}`)
      .send({
        title: 'Granted Test Job',
        company: 'Granted Corp',
        location: 'Remote',
        remote: true,
        category: 'Engineering',
        seniority: 'Junior',
        description: 'Test',
        requirements: ['Python'],
        responsibilities: ['Code'],
        tags: ['python'],
      })
    grantedJobId = jobRes.body.data.id

    const appRes = await request(app)
      .post('/api/applications')
      .set('Authorization', `Bearer ${grantedSeekerToken}`)
      .send({
        jobId: grantedJobId,
        applicantName: 'Granted Seeker',
        applicantEmail: emails[emails.length - 1],
        coverLetter: 'Please consider me',
      })
    grantedApplicationId = appRes.body.data.id
  }, 30_000)

  afterAll(async () => {
    await prisma.application.deleteMany({ where: { id: grantedApplicationId } })
    await prisma.job.deleteMany({ where: { id: grantedJobId } })
    await prisma.roleBinding.deleteMany({ where: { roleId: TEST_ROLE_ID } })
    await prisma.role.deleteMany({ where: { id: TEST_ROLE_ID } })
    await prisma.user.deleteMany({ where: { email: { in: emails } } })
  })

  it('allows the owning granted EMPLOYER to update status', async () => {
    const res = await request(app)
      .patch(`/api/applications/${grantedApplicationId}/status`)
      .set('Authorization', `Bearer ${grantedToken}`)
      .send({ status: 'INTERVIEWING' })
      .expect(200)
    expect(res.body.data.status).toBe('INTERVIEWING')
  })

  it('allows the owning granted EMPLOYER to update hiring data', async () => {
    await request(app)
      .patch(`/api/applications/${grantedApplicationId}/hiring-data`)
      .set('Authorization', `Bearer ${grantedToken}`)
      .send({ interviewData: { date: '2026-09-01T10:00:00.000Z', type: 'video', location: 'Remote' } })
      .expect(200)
  })

  it('forbids a granted EMPLOYER who does not own the job from updating status', async () => {
    await request(app)
      .patch(`/api/applications/${grantedApplicationId}/status`)
      .set('Authorization', `Bearer ${grantedOtherToken}`)
      .send({ status: 'REJECTED' })
      .expect(403)
  })
})
```

Note: `emails` already contains the registering users (the shared `register` helper pushes them), so a single `user.deleteMany({ email: { in: emails } })` in the inner `afterAll` cleans the granted users too. The outer `afterAll` must not double-delete (it won't — `deleteMany` on empty set is a no-op).

**`src/tests/rbac-gating.test.ts` (new):**

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import app from '../app/app'
import { prisma } from '../lib/prisma'

let adminToken = ''
let employerToken = ''
let seekerToken = ''
const emails: string[] = []
const TEST_ROLE_ID = 'test-rbac-gating'

async function register(name: string, role: string, prefix: string) {
  const email = `${prefix}-${Date.now()}@example.com`
  emails.push(email)
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name, email, password: 'password123', role })
  return res.body.data.accessToken as string
}

describe('RBAC role read routes are ADMIN-only', () => {
  beforeAll(async () => {
    const adminEmail = `rbac-admin-${Date.now()}@example.com`
    emails.push(adminEmail)
    await request(app)
      .post('/api/auth/register')
      .send({ name: 'RBAC Admin', email: adminEmail, password: 'password123' })
    await prisma.user.update({ where: { email: adminEmail }, data: { role: 'ADMIN' } })
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: adminEmail, password: 'password123' })
    adminToken = loginRes.body.data.accessToken

    employerToken = await register('RBAC Employer', 'EMPLOYER', 'rbac-emp')
    seekerToken = await register('RBAC Seeker', 'SEEKER', 'rbac-seeker')

    await prisma.role.upsert({
      where: { id: TEST_ROLE_ID },
      update: { name: 'RBAC Gating Role' },
      create: { id: TEST_ROLE_ID, name: 'RBAC Gating Role', description: '', capabilities: ['job:read'] },
    })
  }, 30_000)

  afterAll(async () => {
    await prisma.role.deleteMany({ where: { id: TEST_ROLE_ID } })
    await prisma.user.deleteMany({ where: { email: { in: emails } } })
  })

  it('forbids unauthenticated GET /roles', async () => {
    await request(app).get('/roles').expect(401)
  })

  it('forbids SEEKER GET /roles', async () => {
    await request(app).get('/roles').set('Authorization', `Bearer ${seekerToken}`).expect(403)
  })

  it('forbids EMPLOYER GET /roles', async () => {
    await request(app).get('/roles').set('Authorization', `Bearer ${employerToken}`).expect(403)
  })

  it('allows ADMIN GET /roles', async () => {
    const res = await request(app).get('/roles').set('Authorization', `Bearer ${adminToken}`).expect(200)
    expect(Array.isArray(res.body.data)).toBe(true)
  })

  it('allows ADMIN GET /roles/:id', async () => {
    const res = await request(app)
      .get(`/roles/${TEST_ROLE_ID}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)
    expect(res.body.data).toHaveProperty('id', TEST_ROLE_ID)
  })

  it('forbids SEEKER GET /roles/:id', async () => {
    await request(app)
      .get(`/roles/${TEST_ROLE_ID}`)
      .set('Authorization', `Bearer ${seekerToken}`)
      .expect(403)
  })
})
```

**`src/tests/auth-permissions.test.ts` (new):**

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import app from '../app/app'
import { prisma } from '../lib/prisma'

let adminToken = ''
const emails: string[] = []
const TEST_ROLE_ID = 'test-employer-permissions'

async function register(name: string, role: string, prefix: string) {
  const email = `${prefix}-${Date.now()}@example.com`
  emails.push(email)
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name, email, password: 'password123', role })
  return res.body.data.accessToken as string
}

describe('Auth responses expose effective permissions', () => {
  beforeAll(async () => {
    const adminEmail = `perm-admin-${Date.now()}@example.com`
    emails.push(adminEmail)
    await request(app)
      .post('/api/auth/register')
      .send({ name: 'Perm Admin', email: adminEmail, password: 'password123' })
    await prisma.user.update({ where: { email: adminEmail }, data: { role: 'ADMIN' } })
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: adminEmail, password: 'password123' })
    adminToken = loginRes.body.data.accessToken

    await prisma.role.upsert({
      where: { id: TEST_ROLE_ID },
      update: { capabilities: ['job:create', 'application:update'] },
      create: {
        id: TEST_ROLE_ID,
        name: 'Test Employer Permissions',
        description: '',
        capabilities: ['job:create', 'application:update'],
      },
    })
  }, 30_000)

  afterAll(async () => {
    await prisma.roleBinding.deleteMany({ where: { roleId: TEST_ROLE_ID } })
    await prisma.role.deleteMany({ where: { id: TEST_ROLE_ID } })
    await prisma.user.deleteMany({ where: { email: { in: emails } } })
  })

  it('exposes *:* for ADMIN on login', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: emails[0], password: 'password123' })
      .expect(200)
    expect(res.body.data.user.permissions).toContain('*:*')
  })

  it('exposes *:* for ADMIN via GET /auth/me', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)
    expect(res.body.data.permissions).toEqual(['*:*'])
  })

  it('returns binding capabilities for an EMPLOYER via GET /auth/me', async () => {
    const token = await register('Perm Employer', 'EMPLOYER', 'perm-emp')
    const email = emails[emails.length - 1]
    const user = await prisma.user.findUnique({ where: { email } })
    await prisma.roleBinding.create({
      data: { userId: user!.id, roleId: TEST_ROLE_ID, contextType: 'global' },
    })

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
    expect(res.body.data.permissions).toEqual(expect.arrayContaining(['job:create', 'application:update']))
  })

  it('returns [] for an EMPLOYER with no bindings', async () => {
    const token = await register('Perm Ungranted', 'EMPLOYER', 'perm-ungranted')
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
    expect(res.body.data.permissions).toEqual([])
  })
})
```

- [ ] **Step 1: Add the new describe block** to `applications-hiring-flow.test.ts` (append inside the outer `describe`). Keep all existing tests unchanged.
- [ ] **Step 2: Create `src/tests/rbac-gating.test.ts`** with the content above.
- [ ] **Step 3: Create `src/tests/auth-permissions.test.ts`** with the content above.
- [ ] **Step 4: Verify.** `npm test` from `hirehub-backend/` — ALL tests pass (existing + new). `npx tsc --noEmit` clean.
- [ ] **Step 5: Commit.** `git add src/tests/applications-hiring-flow.test.ts src/tests/rbac-gating.test.ts src/tests/auth-permissions.test.ts`; message `test(rbac): granted employer application access + role gating + auth permissions`.

---

## Task A8: Final whole-branch review + status

- [ ] **Step 1:** Run full verification: `npm test` + `npx tsc --noEmit` from `hirehub-backend/`.
- [ ] **Step 2:** Dispatch an independent final reviewer (subagent-driven-development review template) over the diff of Tasks A1-A7 with this plan as spec. Reviewer verifies: ADMIN short-circuit present; status route uses `requirePermission('application:update')` and `validate` comes after; service enforces ownership; hiring-data EMPLOYER branch requires permission + ownership; auth exposes `permissions` in register/login/getMe with ADMIN `['*:*']`; role read routes ADMIN-only with `/roles/bindings` before `/roles/:id`; seed upserts roles idempotently; tests cover the granted path and clean up all created rows; no `git add -A` used; only named files in commits.
- [ ] **Step 3:** Triage findings; fix blocking ones in follow-up commits.
- [ ] **Step 4:** Update `.superpowers/sdd/progress.md` with a section for this plan (after each task, not just at the end).

## Wrap-Up

Per-feature commits as specified per task. No `git add -A` anywhere. The frontend consumes the new `permissions` field and the `application:update` gating via its own plan (`2026-08-05-applications-rbac-permissions.md` in `hirehub-frontend`); the admin grant UI lands there too.
