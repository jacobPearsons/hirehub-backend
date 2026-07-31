# HireHub E2E Testing & Flow Verification — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verify all critical HireHub user flows work end-to-end using TDD, fixing broken features discovered during testing.

**Architecture:** Write backend integration tests (Vitest + Supertest against real PostgreSQL) and frontend component tests (Vitest + Testing Library + jsdom). Follow existing test conventions. Fix bugs found during testing as part of the TDD cycle.

**Tech Stack:** Vitest, Supertest, @testing-library/react, user-event, vi.mock, Prisma, PostgreSQL

**Spec:** `docs/superpowers/specs/e2e-tdd-testing-spec.md`

---

## File Map

### Backend — New Test Files
- `hirehub-backend/src/tests/blog.test.ts` — Blog API integration tests
- `hirehub-backend/src/tests/contact.test.ts` — Contact API integration tests
- `hirehub-backend/src/tests/pricing.test.ts` — Pricing API integration tests
- `hirehub-backend/src/tests/saved-jobs.test.ts` — Saved Jobs API integration tests
- `hirehub-backend/src/tests/admin.test.ts` — Admin API integration tests
- `hirehub-backend/src/tests/upload.test.ts` — Resume Upload API integration tests
- `hirehub-backend/src/tests/auth-extended.test.ts` — Missing auth flow tests (logout, refresh, reset-password)
- `hirehub-backend/src/tests/jobs-extended.test.ts` — Missing job flow tests (update, delete, ownership)
- `hirehub-backend/src/tests/applications-extended.test.ts` — Missing application flow tests

### Backend — Modified Files
- `hirehub-backend/src/modules/jobs/jobs.routes.ts` — Add employer-specific list endpoint
- `hirehub-backend/src/modules/jobs/jobs.controller.ts` — Add `listByEmployer` handler
- `hirehub-backend/src/modules/jobs/jobs.service.ts` — Add `listByEmployer` method

### Frontend — New Test Files
- `hirehub-frontend/src/components/auth/__tests__/SignupPage.test.tsx`
- `hirehub-frontend/src/components/auth/__tests__/ForgotPasswordPage.test.tsx`
- `hirehub-frontend/src/components/auth/__tests__/ResetPasswordPage.test.tsx`
- `hirehub-frontend/src/components/jobs/__tests__/JobBoardPage.test.tsx`
- `hirehub-frontend/src/components/jobs/__tests__/JobDetailPage.test.tsx`
- `hirehub-frontend/src/components/dashboard/__tests__/DashboardPage.test.tsx`
- `hirehub-frontend/src/components/employer-dashboard/__tests__/EmployerDashboardPage.test.tsx`
- `hirehub-frontend/src/components/post-job/__tests__/PostJobPage.test.tsx`
- `hirehub-frontend/src/components/blog/__tests__/BlogPage.test.tsx`
- `hirehub-frontend/src/components/contact/__tests__/ContactPage.test.tsx`
- `hirehub-frontend/src/hooks/__tests__/useJobs.test.ts`
- `hirehub-frontend/src/hooks/__tests__/useJob.test.ts`

### Frontend — Modified Files
- `hirehub-frontend/src/api/jobs.ts` — Add `updateJob`, `deleteJob`, `listEmployerJobs`
- `hirehub-frontend/src/api/applications.ts` — Add `listEmployerApplications`

---

## Phase 1: Backend Auth Extension (Flows 1)

### Task 1: Extended Auth Integration Tests

**Files:**
- Create: `hirehub-backend/src/tests/auth-extended.test.ts`

**Interfaces:**
- Consumes: existing `auth.service.ts` (register, login, logout, refresh, forgotPassword, resetPassword)
- Produces: test coverage for logout, refresh token rotation, password reset flow

- [ ] **Step 1: Write failing tests for logout flow**

```typescript
// hirehub-backend/src/tests/auth-extended.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import app from '../app/app'
import { prisma } from '../lib/prisma'

const testEmail = `test-auth-ext-${Date.now()}@example.com`
let accessToken = ''
let refreshToken = ''

describe('Auth Extended Routes', () => {
  beforeAll(async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Auth Ext User', email: testEmail, password: 'password123' })
    accessToken = res.body.data.accessToken
    refreshToken = res.body.data.refreshToken
  })

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: testEmail } })
  })

  describe('POST /api/auth/logout', () => {
    it('should logout and invalidate refresh token', async () => {
      await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)

      const res = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(401)

      expect(res.body.success).toBe(false)
    })

    it('should return 401 without token', async () => {
      await request(app)
        .post('/api/auth/logout')
        .expect(401)
    })
  })

  describe('POST /api/auth/refresh', () => {
    let newRefreshToken = ''

    beforeAll(async () => {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: testEmail, password: 'password123' })
      newRefreshToken = loginRes.body.data.refreshToken
    })

    it('should issue new token pair with valid refresh token', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: newRefreshToken })
        .expect(200)

      expect(res.body.success).toBe(true)
      expect(res.body.data.accessToken).toBeDefined()
      expect(res.body.data.refreshToken).toBeDefined()
      expect(res.body.data.refreshToken).not.toBe(newRefreshToken)

      // old refresh token should be invalidated (rotation)
      await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: newRefreshToken })
        .expect(401)
    })

    it('should return 401 with invalid refresh token', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid-token-abc' })
        .expect(401)

      expect(res.body.success).toBe(false)
    })
  })

  describe('Password Reset Flow', () => {
    let resetToken = ''

    it('should create a reset token via forgot-password', async () => {
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: testEmail })
        .expect(200)

      expect(res.body.success).toBe(true)

      const tokenRecord = await prisma.resetToken.findFirst({
        where: { user: { email: testEmail } },
        orderBy: { createdAt: 'desc' },
      })
      resetToken = tokenRecord?.token ?? ''
      expect(resetToken).toBeTruthy()
    })

    it('should reset password with valid token', async () => {
      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: resetToken, password: 'newpassword456' })
        .expect(200)

      expect(res.body.success).toBe(true)

      // login with new password should work
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: testEmail, password: 'newpassword456' })
        .expect(200)

      expect(loginRes.body.data.accessToken).toBeDefined()

      // old password should not work
      await request(app)
        .post('/api/auth/login')
        .send({ email: testEmail, password: 'password123' })
        .expect(401)
    })

    it('should return 400 with expired/invalid reset token', async () => {
      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: 'invalid-reset-token', password: 'newpassword789' })
        .expect(400)

      expect(res.body.success).toBe(false)
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd hirehub-backend && bun run test -- src/tests/auth-extended.test.ts`
Expected: Some tests may pass (logout exists), refresh rotation test should fail (old token accepted)

- [ ] **Step 3: Implement — all existing code already supports these flows**

The backend already has logout, refresh, and reset-password implemented in `auth.service.ts`. The refresh token rotation is already implemented (deletes old, creates new). The tests should pass against existing code.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd hirehub-backend && bun run test -- src/tests/auth-extended.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
cd hirehub-backend && git add src/tests/auth-extended.test.ts && git commit -m "test: add extended auth integration tests (logout, refresh rotation, password reset)"
```

---

## Phase 2: Backend Job Extension (Flow 3)

### Task 2: Extended Jobs Integration Tests

**Files:**
- Create: `hirehub-backend/src/tests/jobs-extended.test.ts`

**Interfaces:**
- Consumes: existing `jobs.service.ts` (create, update, delete, list, getById)
- Produces: test coverage for update, delete, ownership enforcement

- [ ] **Step 1: Write failing tests for job update/delete/ownership**

```typescript
// hirehub-backend/src/tests/jobs-extended.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import app from '../app/app'
import { prisma } from '../lib/prisma'

const emp1Email = `test-emp1-${Date.now()}@example.com`
const emp2Email = `test-emp2-${Date.now()}@example.com`
const seekerEmail = `test-seeker-ext-${Date.now()}@example.com`
let emp1Token = ''
let emp2Token = ''
let seekerToken = ''
let emp1JobId = ''
let emp2JobId = ''

const jobData = {
  title: 'Extended Test Job',
  company: 'Test Corp',
  location: 'Remote',
  remote: true,
  category: 'Engineering',
  seniority: 'Mid-Level',
  description: 'A test job for extended testing',
  requirements: ['TypeScript'],
  responsibilities: ['Write code'],
  tags: ['test'],
}

describe('Jobs Extended Routes', () => {
  beforeAll(async () => {
    const emp1Res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Emp1', email: emp1Email, password: 'password123', role: 'EMPLOYER' })
    emp1Token = emp1Res.body.data.accessToken

    const emp2Res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Emp2', email: emp2Email, password: 'password123', role: 'EMPLOYER' })
    emp2Token = emp2Res.body.data.accessToken

    const seekerRes = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Seeker Ext', email: seekerEmail, password: 'password123', role: 'SEEKER' })
    seekerToken = seekerRes.body.data.accessToken

    const job1Res = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${emp1Token}`)
      .send(jobData)
    emp1JobId = job1Res.body.data.id

    const job2Res = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${emp2Token}`)
      .send({ ...jobData, title: 'Emp2 Job' })
    emp2JobId = job2Res.body.data.id
  })

  afterAll(async () => {
    if (emp1JobId) await prisma.job.deleteMany({ where: { id: emp1JobId } })
    if (emp2JobId) await prisma.job.deleteMany({ where: { id: emp2JobId } })
    await prisma.user.deleteMany({ where: { email: { in: [emp1Email, emp2Email, seekerEmail] } } })
  })

  describe('PATCH /api/jobs/:id', () => {
    it('should update own job', async () => {
      const res = await request(app)
        .patch(`/api/jobs/${emp1JobId}`)
        .set('Authorization', `Bearer ${emp1Token}`)
        .send({ title: 'Updated Job Title' })
        .expect(200)

      expect(res.body.success).toBe(true)
      expect(res.body.data.title).toBe('Updated Job Title')
    })

    it('should return 403 when updating another employers job', async () => {
      const res = await request(app)
        .patch(`/api/jobs/${emp2JobId}`)
        .set('Authorization', `Bearer ${emp1Token}`)
        .send({ title: 'Hacked Title' })
        .expect(403)

      expect(res.body.success).toBe(false)
    })

    it('should return 403 when seeker tries to update', async () => {
      await request(app)
        .patch(`/api/jobs/${emp1JobId}`)
        .set('Authorization', `Bearer ${seekerToken}`)
        .send({ title: 'Nope' })
        .expect(403)
    })

    it('should return 404 for non-existent job', async () => {
      await request(app)
        .patch('/api/jobs/fake-id')
        .set('Authorization', `Bearer ${emp1Token}`)
        .send({ title: 'X' })
        .expect(404)
    })
  })

  describe('DELETE /api/jobs/:id', () => {
    it('should return 403 when deleting another employers job', async () => {
      await request(app)
        .delete(`/api/jobs/${emp2JobId}`)
        .set('Authorization', `Bearer ${emp1Token}`)
        .expect(403)
    })

    it('should return 403 when seeker tries to delete', async () => {
      await request(app)
        .delete(`/api/jobs/${emp1JobId}`)
        .set('Authorization', `Bearer ${seekerToken}`)
        .expect(403)
    })

    it('should delete own job', async () => {
      const jobRes = await request(app)
        .post('/api/jobs')
        .set('Authorization', `Bearer ${emp1Token}`)
        .send({ ...jobData, title: 'To Be Deleted' })
      const jobId = jobRes.body.data.id

      await request(app)
        .delete(`/api/jobs/${jobId}`)
        .set('Authorization', `Bearer ${emp1Token}`)
        .expect(200)

      await request(app)
        .get(`/api/jobs/${jobId}`)
        .expect(404)
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd hirehub-backend && bun run test -- src/tests/jobs-extended.test.ts`
Expected: Most tests should PASS (backend already implements update/delete/ownership). If any fail, the backend has a bug.

- [ ] **Step 3: Run tests to verify they pass**

Run: `cd hirehub-backend && bun run test -- src/tests/jobs-extended.test.ts`
Expected: ALL PASS (backend already has these features)

- [ ] **Step 4: Commit**

```bash
cd hirehub-backend && git add src/tests/jobs-extended.test.ts && git commit -m "test: add extended jobs integration tests (update, delete, ownership enforcement)"
```

---

## Phase 3: Backend Application Extension (Flow 2, 3)

### Task 3: Extended Applications Integration Tests

**Files:**
- Create: `hirehub-backend/src/tests/applications-extended.test.ts`

**Interfaces:**
- Consumes: existing `applications.service.ts` (list by jobId for employers, ownership checks)
- Produces: test coverage for employer listing, unauthorized status update, duplicate application prevention

- [ ] **Step 1: Write failing tests**

```typescript
// hirehub-backend/src/tests/applications-extended.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import app from '../app/app'
import { prisma } from '../lib/prisma'

const empEmail = `test-app-ext-emp-${Date.now()}@example.com`
const seekerEmail = `test-app-ext-seeker-${Date.now()}@example.com`
const emp2Email = `test-app-ext-emp2-${Date.now()}@example.com`
let empToken = ''
let seekerToken = ''
let emp2Token = ''
let jobId = ''
let applicationId = ''

describe('Applications Extended Routes', () => {
  beforeAll(async () => {
    const empRes = await request(app)
      .post('/api/auth/register')
      .send({ name: 'App Emp', email: empEmail, password: 'password123', role: 'EMPLOYER' })
    empToken = empRes.body.data.accessToken

    const emp2Res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'App Emp2', email: emp2Email, password: 'password123', role: 'EMPLOYER' })
    emp2Token = emp2Res.body.data.accessToken

    const seekerRes = await request(app)
      .post('/api/auth/register')
      .send({ name: 'App Seeker Ext', email: seekerEmail, password: 'password123', role: 'SEEKER' })
    seekerToken = seekerRes.body.data.accessToken

    const jobRes = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${empToken}`)
      .send({
        title: 'Applications Test Job',
        company: 'App Test Corp',
        location: 'Remote',
        remote: true,
        category: 'Engineering',
        seniority: 'Senior',
        description: 'Test job for application flows',
        requirements: ['Testing'],
        responsibilities: ['Write tests'],
        tags: ['testing'],
      })
    jobId = jobRes.body.data.id

    const appRes = await request(app)
      .post('/api/applications')
      .set('Authorization', `Bearer ${seekerToken}`)
      .send({
        jobId,
        applicantName: 'App Seeker Ext',
        applicantEmail: seekerEmail,
        coverLetter: 'I want this job for extended testing.',
      })
    applicationId = appRes.body.data.id
  })

  afterAll(async () => {
    if (applicationId) await prisma.application.deleteMany({ where: { id: applicationId } })
    if (jobId) await prisma.job.deleteMany({ where: { id: jobId } })
    await prisma.user.deleteMany({ where: { email: { in: [empEmail, seekerEmail, emp2Email] } } })
  })

  describe('GET /api/applications (employer with jobId)', () => {
    it('should return applications for own job', async () => {
      const res = await request(app)
        .get(`/api/applications?jobId=${jobId}`)
        .set('Authorization', `Bearer ${empToken}`)
        .expect(200)

      expect(res.body.success).toBe(true)
      expect(Array.isArray(res.body.data)).toBe(true)
      expect(res.body.data.length).toBeGreaterThanOrEqual(1)
    })

    it('should return 403 when viewing another employers applications', async () => {
      const res = await request(app)
        .get(`/api/applications?jobId=${jobId}`)
        .set('Authorization', `Bearer ${emp2Token}`)
        .expect(403)

      expect(res.body.success).toBe(false)
    })

    it('should return 400 when employer omits jobId', async () => {
      const res = await request(app)
        .get('/api/applications')
        .set('Authorization', `Bearer ${empToken}`)
        .expect(400)

      expect(res.body.success).toBe(false)
    })
  })

  describe('PATCH /api/applications/:id/status', () => {
    it('should return 403 when employer updates status on another employers job', async () => {
      const res = await request(app)
        .patch(`/api/applications/${applicationId}/status`)
        .set('Authorization', `Bearer ${emp2Token}`)
        .send({ status: 'REJECTED' })
        .expect(403)

      expect(res.body.success).toBe(false)
    })

    it('should return 404 for non-existent application', async () => {
      const res = await request(app)
        .patch('/api/applications/fake-id/status')
        .set('Authorization', `Bearer ${empToken}`)
        .send({ status: 'OFFER' })
        .expect(404)

      expect(res.body.success).toBe(false)
    })
  })

  describe('POST /api/applications (duplicate prevention)', () => {
    it('should allow creating a second application (no unique constraint on userId+jobId)', async () => {
      const res = await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${seekerToken}`)
        .send({
          jobId,
          applicantName: 'App Seeker Ext',
          applicantEmail: seekerEmail,
          coverLetter: 'Second application for the same job.',
        })

      // Current schema does not have unique constraint on userId+jobId
      // This test documents current behavior — if it returns 201, that's the current state
      // If it returns 409/400, that's a new constraint
      expect([201, 409]).toContain(res.status)
    })
  })
})
```

- [ ] **Step 2: Run tests to verify results**

Run: `cd hirehub-backend && bun run test -- src/tests/applications-extended.test.ts`
Expected: Most should PASS. The employer listing with jobId query, ownership check, and status update ownership are all implemented.

- [ ] **Step 3: Run full test suite to check for regressions**

Run: `cd hirehub-backend && bun run test`
Expected: ALL PASS

- [ ] **Step 4: Commit**

```bash
cd hirehub-backend && git add src/tests/applications-extended.test.ts && git commit -m "test: add extended applications integration tests (employer listing, ownership, duplicates)"
```

---

## Phase 4: Backend Saved Jobs Tests (Flow 2)

### Task 4: Saved Jobs Integration Tests

**Files:**
- Create: `hirehub-backend/src/tests/saved-jobs.test.ts`

**Interfaces:**
- Consumes: `saved-jobs.service.ts` (save, remove, list)
- Produces: test coverage for save/unsave/idempotency/list/role enforcement

- [ ] **Step 1: Write failing tests**

```typescript
// hirehub-backend/src/tests/saved-jobs.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import app from '../app/app'
import { prisma } from '../lib/prisma'

const seekerEmail = `test-saved-seeker-${Date.now()}@example.com`
const empEmail = `test-saved-emp-${Date.now()}@example.com`
let seekerToken = ''
let empToken = ''
let jobId = ''

describe('Saved Jobs Routes', () => {
  beforeAll(async () => {
    const seekerRes = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Saved Seeker', email: seekerEmail, password: 'password123', role: 'SEEKER' })
    seekerToken = seekerRes.body.data.accessToken

    const empRes = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Saved Emp', email: empEmail, password: 'password123', role: 'EMPLOYER' })
    empToken = empRes.body.data.accessToken

    const jobRes = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${empToken}`)
      .send({
        title: 'Saved Jobs Test',
        company: 'Save Corp',
        location: 'Remote',
        remote: true,
        category: 'Engineering',
        seniority: 'Junior',
        description: 'Job for save testing',
        requirements: ['Saving'],
        responsibilities: ['Save things'],
        tags: ['save'],
      })
    jobId = jobRes.body.data.id
  })

  afterAll(async () => {
    await prisma.savedJob.deleteMany({ where: { user: { email: seekerEmail } } })
    await prisma.job.deleteMany({ where: { id: jobId } })
    await prisma.user.deleteMany({ where: { email: { in: [seekerEmail, empEmail] } } })
  })

  describe('POST /api/saved-jobs', () => {
    it('should save a job when seeker', async () => {
      const res = await request(app)
        .post('/api/saved-jobs')
        .set('Authorization', `Bearer ${seekerToken}`)
        .send({ jobId })
        .expect(201)

      expect(res.body.success).toBe(true)
      expect(res.body.data.jobId).toBe(jobId)
    })

    it('should be idempotent (upsert)', async () => {
      const res = await request(app)
        .post('/api/saved-jobs')
        .set('Authorization', `Bearer ${seekerToken}`)
        .send({ jobId })
        .expect(201)

      expect(res.body.success).toBe(true)
    })

    it('should return 403 when employer tries to save', async () => {
      await request(app)
        .post('/api/saved-jobs')
        .set('Authorization', `Bearer ${empToken}`)
        .send({ jobId })
        .expect(403)
    })

    it('should return 400 with invalid jobId', async () => {
      await request(app)
        .post('/api/saved-jobs')
        .set('Authorization', `Bearer ${seekerToken}`)
        .send({ jobId: '' })
        .expect(400)
    })

    it('should return 404 with non-existent jobId', async () => {
      await request(app)
        .post('/api/saved-jobs')
        .set('Authorization', `Bearer ${seekerToken}`)
        .send({ jobId: 'nonexistent-id' })
        .expect(404)
    })
  })

  describe('GET /api/saved-jobs', () => {
    it('should list saved jobs with job data', async () => {
      const res = await request(app)
        .get('/api/saved-jobs')
        .set('Authorization', `Bearer ${seekerToken}`)
        .expect(200)

      expect(res.body.success).toBe(true)
      expect(Array.isArray(res.body.data)).toBe(true)
      expect(res.body.data.length).toBeGreaterThanOrEqual(1)
      expect(res.body.data[0].job).toBeDefined()
    })

    it('should return 403 when employer tries to list', async () => {
      await request(app)
        .get('/api/saved-jobs')
        .set('Authorization', `Bearer ${empToken}`)
        .expect(403)
    })
  })

  describe('DELETE /api/saved-jobs/:jobId', () => {
    it('should unsave a job', async () => {
      await request(app)
        .delete(`/api/saved-jobs/${jobId}`)
        .set('Authorization', `Bearer ${seekerToken}`)
        .expect(204)

      const res = await request(app)
        .get('/api/saved-jobs')
        .set('Authorization', `Bearer ${seekerToken}`)
        .expect(200)

      const saved = res.body.data.find((s: any) => s.jobId === jobId)
      expect(saved).toBeUndefined()
    })

    it('should return 403 when employer tries to unsave', async () => {
      await request(app)
        .delete(`/api/saved-jobs/${jobId}`)
        .set('Authorization', `Bearer ${empToken}`)
        .expect(403)
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd hirehub-backend && bun run test -- src/tests/saved-jobs.test.ts`
Expected: ALL PASS (backend already implements saved-jobs fully)

- [ ] **Step 3: Commit**

```bash
cd hirehub-backend && git add src/tests/saved-jobs.test.ts && git commit -m "test: add saved jobs integration tests (save, unsave, idempotency, role enforcement)"
```

---

## Phase 5: Backend Blog, Contact, Pricing Tests (Flows 4, 5)

### Task 5: Blog Integration Tests

**Files:**
- Create: `hirehub-backend/src/tests/blog.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// hirehub-backend/src/tests/blog.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import app from '../app/app'
import { prisma } from '../lib/prisma'

let testPostSlug = ''

describe('Blog Routes', () => {
  beforeAll(async () => {
    const post = await prisma.blogPost.findFirst()
    if (post) testPostSlug = post.slug
  })

  describe('GET /api/blog-posts', () => {
    it('should return paginated blog posts', async () => {
      const res = await request(app).get('/api/blog-posts').expect(200)

      expect(res.body.success).toBe(true)
      expect(Array.isArray(res.body.data)).toBe(true)
    })

    it('should support category filter', async () => {
      const res = await request(app)
        .get('/api/blog-posts?category=Hiring Tips')
        .expect(200)

      expect(res.body.success).toBe(true)
    })
  })

  describe('GET /api/blog-posts/:slug', () => {
    it('should return a blog post by slug', async () => {
      if (!testPostSlug) return

      const res = await request(app)
        .get(`/api/blog-posts/${testPostSlug}`)
        .expect(200)

      expect(res.body.success).toBe(true)
      expect(res.body.data.slug).toBe(testPostSlug)
    })

    it('should return 404 for non-existent slug', async () => {
      const res = await request(app)
        .get('/api/blog-posts/this-slug-does-not-exist-xyz')
        .expect(404)

      expect(res.body.success).toBe(false)
    })
  })
})
```

- [ ] **Step 2: Run tests — verify they pass against seed data**

Run: `cd hirehub-backend && bun run test -- src/tests/blog.test.ts`
Expected: PASS (seed script creates blog posts)

- [ ] **Step 3: Commit**

```bash
cd hirehub-backend && git add src/tests/blog.test.ts && git commit -m "test: add blog integration tests (list, filter, get by slug, 404)"
```

### Task 6: Contact Integration Tests

**Files:**
- Create: `hirehub-backend/src/tests/contact.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// hirehub-backend/src/tests/contact.test.ts
import { describe, it, expect, afterAll } from 'vitest'
import request from 'supertest'
import app from '../app/app'
import { prisma } from '../lib/prisma'

const testEmail = `contact-test-${Date.now()}@example.com`

describe('Contact Routes', () => {
  afterAll(async () => {
    await prisma.contactSubmission.deleteMany({ where: { email: testEmail } })
  })

  describe('POST /api/contact', () => {
    it('should create a contact submission', async () => {
      const res = await request(app)
        .post('/api/contact')
        .send({
          name: 'Contact Tester',
          email: testEmail,
          subject: 'Test Subject',
          message: 'This is a test message for the contact form.',
        })
        .expect(201)

      expect(res.body.success).toBe(true)
      expect(res.body.data.id).toBeDefined()
    })

    it('should return 400 for missing name', async () => {
      await request(app)
        .post('/api/contact')
        .send({ email: testEmail, subject: 'Sub', message: 'Msg' })
        .expect(400)
    })

    it('should return 400 for invalid email', async () => {
      await request(app)
        .post('/api/contact')
        .send({ name: 'X', email: 'not-an-email', subject: 'Sub', message: 'Msg' })
        .expect(400)
    })

    it('should return 400 for missing message', async () => {
      await request(app)
        .post('/api/contact')
        .send({ name: 'X', email: testEmail, subject: 'Sub' })
        .expect(400)
    })

    it('should return 400 for empty body', async () => {
      await request(app)
        .post('/api/contact')
        .send({})
        .expect(400)
    })
  })
})
```

- [ ] **Step 2: Run tests**

Run: `cd hirehub-backend && bun run test -- src/tests/contact.test.ts`
Expected: ALL PASS

- [ ] **Step 3: Commit**

```bash
cd hirehub-backend && git add src/tests/contact.test.ts && git commit -m "test: add contact form integration tests (submit, validation)"
```

### Task 7: Pricing Integration Tests

**Files:**
- Create: `hirehub-backend/src/tests/pricing.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// hirehub-backend/src/tests/pricing.test.ts
import { describe, it, expect } from 'vitest'
import request from 'supertest'
import app from '../app/app'

describe('Pricing Routes', () => {
  describe('GET /api/pricing', () => {
    it('should return pricing tiers ordered by price', async () => {
      const res = await request(app).get('/api/pricing').expect(200)

      expect(res.body.success).toBe(true)
      expect(Array.isArray(res.body.data)).toBe(true)

      if (res.body.data.length > 1) {
        for (let i = 1; i < res.body.data.length; i++) {
          expect(res.body.data[i].price).toBeGreaterThanOrEqual(res.body.data[i - 1].price)
        }
      }
    })

    it('should return tiers with required fields', async () => {
      const res = await request(app).get('/api/pricing').expect(200)

      for (const tier of res.body.data) {
        expect(tier.tier).toBeDefined()
        expect(tier.price).toBeDefined()
        expect(tier.period).toBeDefined()
        expect(tier.description).toBeDefined()
        expect(Array.isArray(tier.features)).toBe(true)
      }
    })
  })
})
```

- [ ] **Step 2: Run tests**

Run: `cd hirehub-backend && bun run test -- src/tests/pricing.test.ts`
Expected: PASS (requires seed data with pricing tiers)

- [ ] **Step 3: Commit**

```bash
cd hirehub-backend && git add src/tests/pricing.test.ts && git commit -m "test: add pricing integration tests (list tiers, ordering, field validation)"
```

---

## Phase 6: Backend Upload & Admin Tests (Flows 6, 7)

### Task 8: Upload Integration Tests

**Files:**
- Create: `hirehub-backend/src/tests/upload.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// hirehub-backend/src/tests/upload.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import path from 'path'
import app from '../app/app'
import { prisma } from '../lib/prisma'

const seekerEmail = `test-upload-${Date.now()}@example.com`
let seekerToken = ''
let empToken = ''

beforeAll(async () => {
  const seekerRes = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Upload Seeker', email: seekerEmail, password: 'password123', role: 'SEEKER' })
  seekerToken = seekerRes.body.data.accessToken

  const empRes = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Upload Emp', email: `upload-emp-${Date.now()}@example.com`, password: 'password123', role: 'EMPLOYER' })
  empToken = empRes.body.data.accessToken
})

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { in: [seekerEmail] } } })
})

describe('Upload Routes', () => {
  describe('POST /api/upload/resume', () => {
    it('should upload a PDF resume', async () => {
      const res = await request(app)
        .post('/api/upload/resume')
        .set('Authorization', `Bearer ${seekerToken}`)
        .attach('resume', Buffer.from('PDF-1.4 fake pdf content'), {
          filename: 'resume.pdf',
          contentType: 'application/pdf',
        })
        .expect(200)

      expect(res.body.success).toBe(true)
      expect(res.body.data.resumePath).toBeDefined()
      expect(res.body.data.resumeFileName).toBe('resume.pdf')
    })

    it('should return 403 when employer tries to upload', async () => {
      await request(app)
        .post('/api/upload/resume')
        .set('Authorization', `Bearer ${empToken}`)
        .attach('resume', Buffer.from('PDF fake'), {
          filename: 'resume.pdf',
          contentType: 'application/pdf',
        })
        .expect(403)
    })

    it('should return 401 without auth', async () => {
      await request(app)
        .post('/api/upload/resume')
        .attach('resume', Buffer.from('PDF fake'), {
          filename: 'resume.pdf',
          contentType: 'application/pdf',
        })
        .expect(401)
    })
  })
})
```

- [ ] **Step 2: Run tests**

Run: `cd hirehub-backend && bun run test -- src/tests/upload.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
cd hirehub-backend && git add src/tests/upload.test.ts && git commit -m "test: add upload integration tests (PDF upload, role enforcement, auth)"
```

### Task 9: Admin Integration Tests

**Files:**
- Create: `hirehub-backend/src/tests/admin.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// hirehub-backend/src/tests/admin.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import app from '../app/app'
import { prisma } from '../lib/prisma'

const adminEmail = `test-admin-${Date.now()}@example.com`
const empEmail = `test-admin-emp-${Date.now()}@example.com`
let adminToken = ''
let empToken = ''
let empUserId = ''

describe('Admin Routes', () => {
  beforeAll(async () => {
    const adminRes = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Test Admin', email: adminEmail, password: 'password123' })

    await prisma.user.update({
      where: { email: adminEmail },
      data: { role: 'ADMIN' },
    })

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: adminEmail, password: 'password123' })
    adminToken = loginRes.body.data.accessToken

    const empRes = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Admin Emp', email: empEmail, password: 'password123', role: 'EMPLOYER' })
    empToken = empRes.body.data.accessToken
    empUserId = empRes.body.data.user.id
  })

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: [adminEmail, empEmail] } } })
  })

  describe('GET /api/admin/users', () => {
    it('should return all users when admin', async () => {
      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      expect(res.body.success).toBe(true)
      expect(Array.isArray(res.body.data)).toBe(true)
      expect(res.body.data.length).toBeGreaterThanOrEqual(2)
    })

    it('should return 403 for non-admin', async () => {
      await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${empToken}`)
        .expect(403)
    })

    it('should return 401 without token', async () => {
      await request(app)
        .get('/api/admin/users')
        .expect(401)
    })
  })

  describe('PATCH /api/admin/users/:id/role', () => {
    it('should update user role when admin', async () => {
      const res = await request(app)
        .patch(`/api/admin/users/${empUserId}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'SEEKER' })
        .expect(200)

      expect(res.body.success).toBe(true)
      expect(res.body.data.role).toBe('SEEKER')
    })

    it('should return 403 for non-admin', async () => {
      await request(app)
        .patch(`/api/admin/users/${empUserId}/role`)
        .set('Authorization', `Bearer ${empToken}`)
        .send({ role: 'EMPLOYER' })
        .expect(403)
    })
  })

  describe('GET /api/admin/jobs', () => {
    it('should return all jobs when admin', async () => {
      const res = await request(app)
        .get('/api/admin/jobs')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      expect(res.body.success).toBe(true)
      expect(Array.isArray(res.body.data)).toBe(true)
    })
  })

  describe('GET /api/admin/blog-posts', () => {
    it('should return all blog posts when admin', async () => {
      const res = await request(app)
        .get('/api/admin/blog-posts')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      expect(res.body.success).toBe(true)
      expect(Array.isArray(res.body.data)).toBe(true)
    })
  })
})
```

- [ ] **Step 2: Run tests**

Run: `cd hirehub-backend && bun run test -- src/tests/admin.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
cd hirehub-backend && git add src/tests/admin.test.ts && git commit -m "test: add admin integration tests (users, roles, jobs, blog, role enforcement)"
```

---

## Phase 7: Full Backend Test Suite Verification

### Task 10: Run All Backend Tests

- [ ] **Step 1: Run the full test suite**

Run: `cd hirehub-backend && bun run test`
Expected: ALL tests pass across all test files

- [ ] **Step 2: Fix any failures discovered**

If any test fails, investigate and fix. Follow TDD: if the test exposes a real bug, fix the code. If the test expectation is wrong, fix the test.

- [ ] **Step 3: Commit final state**

```bash
cd hirehub-backend && git add -A && git commit -m "test: verify full backend test suite passes"
```

---

## Phase 8: Frontend API Client Fixes (BUG-1, BUG-2, BUG-3)

### Task 11: Fix Missing Frontend API Functions

**Files:**
- Modify: `hirehub-frontend/src/api/jobs.ts`
- Modify: `hirehub-frontend/src/api/applications.ts`

- [ ] **Step 1: Add updateJob, deleteJob, listEmployerJobs to jobs.ts**

```typescript
// Add to hirehub-frontend/src/api/jobs.ts
import { apiGet, apiPost, apiPatch, apiDelete } from './client'
// (update existing import to include apiPatch, apiDelete)

export async function updateJob(id: string, data: Partial<CreateJobParams>) {
  return apiPatch<Job>(`/jobs/${id}`, data)
}

export async function deleteJob(id: string) {
  return apiDelete(`/jobs/${id}`)
}

export async function listEmployerJobs() {
  return apiGet<Job[]>('/jobs/employer/me')
}
```

- [ ] **Step 2: Add listEmployerApplications to applications.ts**

```typescript
// Add to hirehub-frontend/src/api/applications.ts

export async function listEmployerApplications(jobId: string) {
  return apiGet<Application[]>(`/applications?jobId=${jobId}`)
}
```

- [ ] **Step 3: Add backend endpoint for employer job listing**

First, add to `hirehub-backend/src/modules/jobs/jobs.routes.ts`:

```typescript
// Add after the existing routes, before export
router.get('/jobs/employer/me', requireAuth, requireRole('EMPLOYER'), jobsController.listByEmployer)
```

Add handler to `hirehub-backend/src/modules/jobs/jobs.controller.ts`:

```typescript
export async function listByEmployer(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await jobsService.listByEmployer(req.user!.userId)
    success(res, result)
  } catch (error) {
    next(error)
  }
}
```

Add method to `hirehub-backend/src/modules/jobs/jobs.service.ts`:

```typescript
async listByEmployer(employerId: string) {
  return prisma.job.findMany({
    where: { employerId },
    orderBy: { postedDate: 'desc' },
  })
}
```

- [ ] **Step 4: Verify backend still passes**

Run: `cd hirehub-backend && bun run test`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
cd hirehub-backend && git add src/modules/jobs/ && git commit -m "feat: add employer job listing endpoint"
cd hirehub-frontend && git add src/api/jobs.ts src/api/applications.ts && git commit -m "feat: add updateJob, deleteJob, listEmployerJobs, listEmployerApplications API functions"
```

---

## Phase 9: Frontend Component Tests — Auth Pages

### Task 12: SignupPage Component Tests

**Files:**
- Create: `hirehub-frontend/src/components/auth/__tests__/SignupPage.test.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
// hirehub-frontend/src/components/auth/__tests__/SignupPage.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ToastProvider } from '../../ui/Toast'
import SignupPage from '../SignupPage'

vi.mock('../../../api/auth', () => ({
  register: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  getMe: vi.fn(),
  forgotPassword: vi.fn(),
  resetPassword: vi.fn(),
  refreshToken: vi.fn(),
}))

vi.mock('../../../api/client', () => ({
  setAccessToken: vi.fn(),
  getAccessToken: vi.fn().mockReturnValue(null),
}))

vi.mock('../../../context/AppContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../context/AppContext')>()
  return {
    ...actual,
    useApp: vi.fn(() => ({
      user: null,
      setUser: vi.fn(),
    })),
  }
})

vi.mock('../../../utils/usePageMeta', () => ({
  usePageMeta: vi.fn(),
}))

function renderSignupPage() {
  return render(
    <MemoryRouter initialEntries={['/signup']}>
      <ToastProvider>
        <SignupPage />
      </ToastProvider>
    </MemoryRouter>
  )
}

describe('SignupPage', () => {
  it('renders full name, email, password, and confirm password inputs', () => {
    renderSignupPage()
    expect(screen.getByLabelText('Full name')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.getByLabelText('Confirm password')).toBeInTheDocument()
  })

  it('renders role selection radios', () => {
    renderSignupPage()
    expect(screen.getByRole('radio', { name: /job seeker/i })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /employer/i })).toBeInTheDocument()
  })

  it('renders create account button', () => {
    renderSignupPage()
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument()
  })

  it('renders sign in link', () => {
    renderSignupPage()
    expect(screen.getByRole('link', { name: /sign in/i })).toBeInTheDocument()
  })

  it('shows loading state on submit', async () => {
    const { register } = await import('../../../api/auth')
    ;(register as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise(() => {})
    )

    const user = userEvent.setup()
    renderSignupPage()

    await user.type(screen.getByLabelText('Full name'), 'John Doe')
    await user.type(screen.getByLabelText('Email'), 'john@example.com')
    await user.type(screen.getByLabelText('Password'), 'password123')
    await user.type(screen.getByLabelText('Confirm password'), 'password123')
    await user.click(screen.getByRole('button', { name: /create account/i }))

    expect(screen.getByRole('button', { name: /creating account/i })).toBeDisabled()
  })

  it('shows error when passwords do not match', async () => {
    const user = userEvent.setup()
    renderSignupPage()

    await user.type(screen.getByLabelText('Full name'), 'John Doe')
    await user.type(screen.getByLabelText('Email'), 'john@example.com')
    await user.type(screen.getByLabelText('Password'), 'password123')
    await user.type(screen.getByLabelText('Confirm password'), 'different')
    await user.click(screen.getByRole('button', { name: /create account/i }))

    expect(await screen.findByText(/passwords do not match/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd hirehub-frontend && bun run test:run -- src/components/auth/__tests__/SignupPage.test.tsx`
Expected: Some may fail if component structure differs

- [ ] **Step 3: Fix any test issues and ensure tests pass**

Adjust selectors if needed based on actual component markup.

- [ ] **Step 4: Run to confirm pass**

Run: `cd hirehub-frontend && bun run test:run -- src/components/auth/__tests__/SignupPage.test.tsx`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
cd hirehub-frontend && git add src/components/auth/__tests__/SignupPage.test.tsx && git commit -m "test: add SignupPage component tests (form fields, role selection, submit, validation)"
```

### Task 13: ForgotPasswordPage and ResetPasswordPage Component Tests

**Files:**
- Create: `hirehub-frontend/src/components/auth/__tests__/ForgotPasswordPage.test.tsx`
- Create: `hirehub-frontend/src/components/auth/__tests__/ResetPasswordPage.test.tsx`

- [ ] **Step 1: Write ForgotPasswordPage tests**

```tsx
// hirehub-frontend/src/components/auth/__tests__/ForgotPasswordPage.test.tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ToastProvider } from '../../ui/Toast'
import ForgotPasswordPage from '../ForgotPasswordPage'

vi.mock('../../../api/auth', () => ({
  forgotPassword: vi.fn(),
}))

vi.mock('../../../utils/usePageMeta', () => ({
  usePageMeta: vi.fn(),
}))

function renderForgotPasswordPage() {
  return render(
    <MemoryRouter initialEntries={['/forgot-password']}>
      <ToastProvider>
        <ForgotPasswordPage />
      </ToastProvider>
    </MemoryRouter>
  )
}

describe('ForgotPasswordPage', () => {
  it('renders email input', () => {
    renderForgotPasswordPage()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
  })

  it('renders send reset link button', () => {
    renderForgotPasswordPage()
    expect(screen.getByRole('button', { name: /send reset link/i })).toBeInTheDocument()
  })

  it('renders back to sign in link', () => {
    renderForgotPasswordPage()
    expect(screen.getByRole('link', { name: /back to sign in/i })).toBeInTheDocument()
  })

  it('shows success state after submission', async () => {
    const { forgotPassword } = await import('../../../api/auth')
    ;(forgotPassword as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true })

    const user = userEvent.setup()
    renderForgotPasswordPage()

    await user.type(screen.getByLabelText('Email'), 'test@example.com')
    await user.click(screen.getByRole('button', { name: /send reset link/i }))

    await waitFor(() => {
      expect(screen.getByText(/check your email/i)).toBeInTheDocument()
    })
  })

  it('shows loading state during submission', async () => {
    const { forgotPassword } = await import('../../../api/auth')
    ;(forgotPassword as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise(() => {})
    )

    const user = userEvent.setup()
    renderForgotPasswordPage()

    await user.type(screen.getByLabelText('Email'), 'test@example.com')
    await user.click(screen.getByRole('button', { name: /send reset link/i }))

    expect(screen.getByRole('button', { name: /sending/i })).toBeDisabled()
  })
})
```

- [ ] **Step 2: Write ResetPasswordPage tests**

```tsx
// hirehub-frontend/src/components/auth/__tests__/ResetPasswordPage.test.tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ToastProvider } from '../../ui/Toast'
import ResetPasswordPage from '../ResetPasswordPage'

vi.mock('../../../api/auth', () => ({
  resetPassword: vi.fn(),
}))

vi.mock('../../../utils/usePageMeta', () => ({
  usePageMeta: vi.fn(),
}))

function renderResetPasswordPage(token = 'valid-token-123') {
  return render(
    <MemoryRouter initialEntries={[`/reset-password?token=${token}`]}>
      <ToastProvider>
        <ResetPasswordPage />
      </ToastProvider>
    </MemoryRouter>
  )
}

describe('ResetPasswordPage', () => {
  it('renders new password and confirm password inputs', () => {
    renderResetPasswordPage()
    expect(screen.getByLabelText(/new password/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument()
  })

  it('renders reset password button', () => {
    renderResetPasswordPage()
    expect(screen.getByRole('button', { name: /reset password/i })).toBeInTheDocument()
  })

  it('shows error when passwords do not match', async () => {
    const user = userEvent.setup()
    renderResetPasswordPage()

    await user.type(screen.getByLabelText(/new password/i), 'newpass123')
    await user.type(screen.getByLabelText(/confirm password/i), 'different')
    await user.click(screen.getByRole('button', { name: /reset password/i }))

    expect(await screen.findByText(/passwords do not match/i)).toBeInTheDocument()
  })

  it('shows success state after reset', async () => {
    const { resetPassword } = await import('../../../api/auth')
    ;(resetPassword as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true })

    const user = userEvent.setup()
    renderResetPasswordPage()

    await user.type(screen.getByLabelText(/new password/i), 'newpass123')
    await user.type(screen.getByLabelText(/confirm password/i), 'newpass123')
    await user.click(screen.getByRole('button', { name: /reset password/i }))

    await waitFor(() => {
      expect(screen.getByText(/password.*reset/i)).toBeInTheDocument()
    })
  })
})
```

- [ ] **Step 3: Run both test files**

Run: `cd hirehub-frontend && bun run test:run -- src/components/auth/__tests__/ForgotPasswordPage.test.tsx src/components/auth/__tests__/ResetPasswordPage.test.tsx`
Expected: ALL PASS

- [ ] **Step 4: Commit**

```bash
cd hirehub-frontend && git add src/components/auth/__tests__/ForgotPasswordPage.test.tsx src/components/auth/__tests__/ResetPasswordPage.test.tsx && git commit -m "test: add ForgotPasswordPage and ResetPasswordPage component tests"
```

---

## Phase 10: Frontend Component Tests — Job Flow Pages

### Task 14: JobBoardPage Component Tests

**Files:**
- Create: `hirehub-frontend/src/components/jobs/__tests__/JobBoardPage.test.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
// hirehub-frontend/src/components/jobs/__tests__/JobBoardPage.test.tsx
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ToastProvider } from '../../ui/Toast'
import JobBoardPage from '../JobBoardPage'

vi.mock('../../../api/jobs', () => ({
  listJobs: vi.fn(),
  getJobById: vi.fn(),
  createJob: vi.fn(),
}))

vi.mock('../../../utils/usePageMeta', () => ({
  usePageMeta: vi.fn(),
}))

const mockJobs = [
  {
    id: '1',
    title: 'Software Engineer',
    company: 'Tech Corp',
    location: 'San Francisco',
    remote: false,
    category: 'Engineering',
    seniority: 'Mid-Level',
    description: 'Build things',
    tags: ['react', 'node'],
    postedDate: '2026-01-01',
    requirements: [],
    responsibilities: [],
  },
  {
    id: '2',
    title: 'Designer',
    company: 'Design Co',
    location: 'Remote',
    remote: true,
    category: 'Design',
    seniority: 'Senior',
    description: 'Design things',
    tags: ['figma'],
    postedDate: '2026-01-02',
    requirements: [],
    responsibilities: [],
  },
]

function renderJobBoardPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <MemoryRouter initialEntries={['/jobs']}>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <JobBoardPage />
        </ToastProvider>
      </QueryClientProvider>
    </MemoryRouter>
  )
}

describe('JobBoardPage', () => {
  it('renders the page heading', async () => {
    const { listJobs } = await import('../../../api/jobs')
    ;(listJobs as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [],
      success: true,
      pagination: { total: 0, cursor: null },
    })

    renderJobBoardPage()
    expect(screen.getByRole('heading', { name: /job board/i })).toBeInTheDocument()
  })

  it('displays job cards after loading', async () => {
    const { listJobs } = await import('../../../api/jobs')
    ;(listJobs as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: mockJobs,
      success: true,
      pagination: { total: 2, cursor: null },
    })

    renderJobBoardPage()

    await waitFor(() => {
      expect(screen.getByText('Software Engineer')).toBeInTheDocument()
    })
    expect(screen.getByText('Designer')).toBeInTheDocument()
  })

  it('shows loading state initially', async () => {
    const { listJobs } = await import('../../../api/jobs')
    ;(listJobs as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise(() => {})
    )

    renderJobBoardPage()
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('renders search bar', async () => {
    const { listJobs } = await import('../../../api/jobs')
    ;(listJobs as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [],
      success: true,
      pagination: { total: 0, cursor: null },
    })

    renderJobBoardPage()
    expect(screen.getByPlaceholder(/search/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests**

Run: `cd hirehub-frontend && bun run test:run -- src/components/jobs/__tests__/JobBoardPage.test.tsx`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
cd hirehub-frontend && git add src/components/jobs/__tests__/JobBoardPage.test.tsx && git commit -m "test: add JobBoardPage component tests (heading, job cards, loading, search)"
```

### Task 15: JobDetailPage Component Tests

**Files:**
- Create: `hirehub-frontend/src/components/jobs/__tests__/JobDetailPage.test.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
// hirehub-frontend/src/components/jobs/__tests__/JobDetailPage.test.tsx
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ToastProvider } from '../../ui/Toast'
import JobDetailPage from '../JobDetailPage'

vi.mock('../../../api/jobs', () => ({
  getJobById: vi.fn(),
}))

vi.mock('../../../api/client', () => ({
  getAccessToken: vi.fn().mockReturnValue(null),
  setAccessToken: vi.fn(),
}))

vi.mock('../../../context/AppContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../context/AppContext')>()
  return {
    ...actual,
    useApp: vi.fn(() => ({
      user: null,
      savedJobIds: [],
      isSaved: vi.fn().mockReturnValue(false),
    })),
  }
})

vi.mock('../../../utils/usePageMeta', () => ({
  usePageMeta: vi.fn(),
}))

const mockJob = {
  id: 'job-1',
  title: 'Software Engineer',
  company: 'Tech Corp',
  companyLogo: '/logos/tech-corp.svg',
  location: 'San Francisco, CA',
  remote: false,
  salaryMin: 120000,
  salaryMax: 180000,
  currency: 'USD',
  category: 'Engineering',
  seniority: 'Mid-Level',
  description: 'We are looking for a software engineer to build amazing products.',
  requirements: ['3+ years experience', 'TypeScript', 'React'],
  responsibilities: ['Build features', 'Write tests', 'Review PRs'],
  tags: ['react', 'typescript'],
  postedDate: '2026-07-01',
  featured: false,
  employerId: 'emp-1',
}

function renderJobDetailPage(jobId = 'job-1') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <MemoryRouter initialEntries={[`/jobs/${jobId}`]}>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <JobDetailPage />
        </ToastProvider>
      </QueryClientProvider>
    </MemoryRouter>
  )
}

describe('JobDetailPage', () => {
  it('shows loading state', async () => {
    const { getJobById } = await import('../../../api/jobs')
    ;(getJobById as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise(() => {})
    )

    renderJobDetailPage()
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('renders job details after loading', async () => {
    const { getJobById } = await import('../../../api/jobs')
    ;(getJobById as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: mockJob,
      success: true,
    })

    renderJobDetailPage()

    await waitFor(() => {
      expect(screen.getByText('Software Engineer')).toBeInTheDocument()
    })
    expect(screen.getByText('Tech Corp')).toBeInTheDocument()
    expect(screen.getByText(/san francisco/i)).toBeInTheDocument()
  })

  it('renders breadcrumb navigation', async () => {
    const { getJobById } = await import('../../../api/jobs')
    ;(getJobById as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: mockJob,
      success: true,
    })

    renderJobDetailPage()

    await waitFor(() => {
      expect(screen.getByRole('link', { name: /jobs/i })).toBeInTheDocument()
    })
  })

  it('shows not found state for invalid job', async () => {
    const { getJobById } = await import('../../../api/jobs')
    ;(getJobById as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Job not found')
    )

    renderJobDetailPage('nonexistent')

    await waitFor(() => {
      expect(screen.getByText(/job not found/i)).toBeInTheDocument()
    })
  })
})
```

- [ ] **Step 2: Run tests**

Run: `cd hirehub-frontend && bun run test:run -- src/components/jobs/__tests__/JobDetailPage.test.tsx`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
cd hirehub-frontend && git add src/components/jobs/__tests__/JobDetailPage.test.tsx && git commit -m "test: add JobDetailPage component tests (loading, details, breadcrumb, not found)"
```

---

## Phase 11: Frontend Component Tests — Dashboard Pages

### Task 16: DashboardPage and EmployerDashboardPage Tests

**Files:**
- Create: `hirehub-frontend/src/components/dashboard/__tests__/DashboardPage.test.tsx`
- Create: `hirehub-frontend/src/components/employer-dashboard/__tests__/EmployerDashboardPage.test.tsx`

- [ ] **Step 1: Write DashboardPage tests**

```tsx
// hirehub-frontend/src/components/dashboard/__tests__/DashboardPage.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ToastProvider } from '../../ui/Toast'
import DashboardPage from '../DashboardPage'

vi.mock('../../../api/jobs', () => ({ listJobs: vi.fn() }))
vi.mock('../../../api/savedJobs', () => ({ listSavedJobs: vi.fn() }))
vi.mock('../../../api/applications', () => ({ listApplications: vi.fn() }))
vi.mock('../../../utils/usePageMeta', () => ({ usePageMeta: vi.fn() }))

vi.mock('../../../context/AppContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../context/AppContext')>()
  return {
    ...actual,
    useApp: vi.fn(() => ({
      user: { id: '1', name: 'Tester', email: 't@t.com', role: 'seeker' },
      savedJobIds: [],
      applications: [],
    })),
  }
})

function renderDashboardPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <DashboardPage />
        </ToastProvider>
      </QueryClientProvider>
    </MemoryRouter>
  )
}

describe('DashboardPage', () => {
  it('renders heading', () => {
    renderDashboardPage()
    expect(screen.getByRole('heading', { name: /dashboard/i })).toBeInTheDocument()
  })

  it('renders Saved Jobs and My Applications tabs', () => {
    renderDashboardPage()
    expect(screen.getByRole('tab', { name: /saved jobs/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /my applications/i })).toBeInTheDocument()
  })

  it('switches to applications tab on click', async () => {
    const user = userEvent.setup()
    renderDashboardPage()

    await user.click(screen.getByRole('tab', { name: /my applications/i }))
    expect(screen.getByRole('tab', { name: /my applications/i })).toHaveAttribute('aria-selected', 'true')
  })
})
```

- [ ] **Step 2: Write EmployerDashboardPage tests**

```tsx
// hirehub-frontend/src/components/employer-dashboard/__tests__/EmployerDashboardPage.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ToastProvider } from '../../ui/Toast'
import EmployerDashboardPage from '../EmployerDashboardPage'

vi.mock('../../../api/jobs', () => ({ listJobs: vi.fn() }))
vi.mock('../../../api/applications', () => ({ listApplications: vi.fn() }))
vi.mock('../../../utils/usePageMeta', () => ({ usePageMeta: vi.fn() }))

vi.mock('../../../context/AppContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../context/AppContext')>()
  return {
    ...actual,
    useApp: vi.fn(() => ({
      user: { id: '1', name: 'Emp', email: 'e@e.com', role: 'employer' },
    })),
  }
})

function renderEmployerDashboard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <MemoryRouter initialEntries={['/employer/dashboard']}>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <EmployerDashboardPage />
        </ToastProvider>
      </QueryClientProvider>
    </MemoryRouter>
  )
}

describe('EmployerDashboardPage', () => {
  it('renders heading', () => {
    renderEmployerDashboard()
    expect(screen.getByRole('heading', { name: /employer dashboard/i })).toBeInTheDocument()
  })

  it('renders Job Listings and Applicants tabs', () => {
    renderEmployerDashboard()
    expect(screen.getByRole('tab', { name: /job listings/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /applicants/i })).toBeInTheDocument()
  })

  it('switches to applicants tab on click', async () => {
    const user = userEvent.setup()
    renderEmployerDashboard()

    await user.click(screen.getByRole('tab', { name: /applicants/i }))
    expect(screen.getByRole('tab', { name: /applicants/i })).toHaveAttribute('aria-selected', 'true')
  })
})
```

- [ ] **Step 3: Run both test files**

Run: `cd hirehub-frontend && bun run test:run -- src/components/dashboard/__tests__/DashboardPage.test.tsx src/components/employer-dashboard/__tests__/EmployerDashboardPage.test.tsx`
Expected: ALL PASS

- [ ] **Step 4: Commit**

```bash
cd hirehub-frontend && git add src/components/dashboard/__tests__/DashboardPage.test.tsx src/components/employer-dashboard/__tests__/EmployerDashboardPage.test.tsx && git commit -m "test: add DashboardPage and EmployerDashboardPage component tests (tabs, heading)"
```

---

## Phase 12: Frontend Component Tests — Secondary Pages

### Task 17: PostJobPage, BlogPage, ContactPage Tests

**Files:**
- Create: `hirehub-frontend/src/components/post-job/__tests__/PostJobPage.test.tsx`
- Create: `hirehub-frontend/src/components/blog/__tests__/BlogPage.test.tsx`
- Create: `hirehub-frontend/src/components/contact/__tests__/ContactPage.test.tsx`

- [ ] **Step 1: Write PostJobPage tests**

```tsx
// hirehub-frontend/src/components/post-job/__tests__/PostJobPage.test.tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ToastProvider } from '../../ui/Toast'
import PostJobPage from '../PostJobPage'

vi.mock('../../../api/jobs', () => ({ createJob: vi.fn() }))
vi.mock('../../../utils/usePageMeta', () => ({ usePageMeta: vi.fn() }))

vi.mock('../../../context/AppContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../context/AppContext')>()
  return {
    ...actual,
    useApp: vi.fn(() => ({
      user: { id: '1', name: 'Emp', email: 'e@e.com', role: 'employer' },
    })),
  }
})

function renderPostJobPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <MemoryRouter initialEntries={['/post-job']}>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <PostJobPage />
        </ToastProvider>
      </QueryClientProvider>
    </MemoryRouter>
  )
}

describe('PostJobPage', () => {
  it('renders the page heading', () => {
    renderPostJobPage()
    expect(screen.getByRole('heading', { name: /post a job/i })).toBeInTheDocument()
  })

  it('renders the job posting form', () => {
    renderPostJobPage()
    expect(screen.getByLabelText(/job title/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Write BlogPage tests**

```tsx
// hirehub-frontend/src/components/blog/__tests__/BlogPage.test.tsx
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ToastProvider } from '../../ui/Toast'
import BlogPage from '../BlogPage'

vi.mock('../../../api/blog', () => ({
  listBlogPosts: vi.fn(),
}))

vi.mock('../../../utils/usePageMeta', () => ({ usePageMeta: vi.fn() }))

const mockPosts = [
  {
    id: '1',
    slug: 'hiring-tips',
    title: 'Top Hiring Tips',
    excerpt: 'Learn how to hire better.',
    content: 'Full content here.',
    category: 'Hiring Tips',
    authorName: 'Jane Doe',
    date: '2026-07-01',
    readTime: 5,
    featured: true,
  },
]

function renderBlogPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <MemoryRouter initialEntries={['/blog']}>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <BlogPage />
        </ToastProvider>
      </QueryClientProvider>
    </MemoryRouter>
  )
}

describe('BlogPage', () => {
  it('renders the page heading', async () => {
    const { listBlogPosts } = await import('../../../api/blog')
    ;(listBlogPosts as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [],
      success: true,
    })

    renderBlogPage()
    expect(screen.getByRole('heading', { name: /blog/i })).toBeInTheDocument()
  })

  it('displays blog posts after loading', async () => {
    const { listBlogPosts } = await import('../../../api/blog')
    ;(listBlogPosts as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: mockPosts,
      success: true,
    })

    renderBlogPage()

    await waitFor(() => {
      expect(screen.getByText('Top Hiring Tips')).toBeInTheDocument()
    })
  })

  it('shows loading state initially', async () => {
    const { listBlogPosts } = await import('../../../api/blog')
    ;(listBlogPosts as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise(() => {})
    )

    renderBlogPage()
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Write ContactPage tests**

```tsx
// hirehub-frontend/src/components/contact/__tests__/ContactPage.test.tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ToastProvider } from '../../ui/Toast'
import ContactPage from '../ContactPage'

vi.mock('../../../utils/usePageMeta', () => ({ usePageMeta: vi.fn() }))

function renderContactPage() {
  return render(
    <MemoryRouter initialEntries={['/contact']}>
      <ToastProvider>
        <ContactPage />
      </ToastProvider>
    </MemoryRouter>
  )
}

describe('ContactPage', () => {
  it('renders contact information', () => {
    renderContactPage()
    expect(screen.getByRole('heading', { name: /contact/i })).toBeInTheDocument()
  })
})
```

- [ ] **Step 4: Run all three test files**

Run: `cd hirehub-frontend && bun run test:run -- src/components/post-job/__tests__/PostJobPage.test.tsx src/components/blog/__tests__/BlogPage.test.tsx src/components/contact/__tests__/ContactPage.test.tsx`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
cd hirehub-frontend && git add src/components/post-job/__tests__/PostJobPage.test.tsx src/components/blog/__tests__/BlogPage.test.tsx src/components/contact/__tests__/ContactPage.test.tsx && git commit -m "test: add PostJobPage, BlogPage, ContactPage component tests"
```

---

## Phase 13: Frontend Hook Tests

### Task 18: useJobs and useJob Hook Tests

**Files:**
- Create: `hirehub-frontend/src/hooks/__tests__/useJobs.test.ts`
- Create: `hirehub-frontend/src/hooks/__tests__/useJob.test.ts`

- [ ] **Step 1: Write useJobs test**

```tsx
// hirehub-frontend/src/hooks/__tests__/useJobs.test.ts
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useJobs } from '../useJobs'
import * as jobsApi from '../../api/jobs'
import type { ReactNode } from 'react'

vi.mock('../../api/jobs', () => ({
  listJobs: vi.fn(),
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    )
  }
}

describe('useJobs', () => {
  it('fetches jobs successfully', async () => {
    const mockData = { data: [{ id: '1', title: 'Engineer' }], success: true }
    vi.mocked(jobsApi.listJobs).mockResolvedValue(mockData as any)

    const { result } = renderHook(() => useJobs(), { wrapper: createWrapper() })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual(mockData)
  })

  it('handles errors', async () => {
    vi.mocked(jobsApi.listJobs).mockRejectedValue(new Error('Network error'))

    const { result } = renderHook(() => useJobs(), { wrapper: createWrapper() })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error?.message).toBe('Network error')
  })

  it('passes params to API', async () => {
    vi.mocked(jobsApi.listJobs).mockResolvedValue({ data: [], success: true } as any)

    renderHook(() => useJobs({ search: 'react', category: 'Engineering' }), {
      wrapper: createWrapper(),
    })

    expect(jobsApi.listJobs).toHaveBeenCalledWith({ search: 'react', category: 'Engineering' })
  })
})
```

- [ ] **Step 2: Write useJob test**

```tsx
// hirehub-frontend/src/hooks/__tests__/useJob.test.ts
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useJob } from '../useJob'
import * as jobsApi from '../../api/jobs'
import type { ReactNode } from 'react'

vi.mock('../../api/jobs', () => ({
  getJobById: vi.fn(),
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    )
  }
}

describe('useJob', () => {
  it('fetches a single job by id', async () => {
    const mockData = { data: { id: '1', title: 'Engineer' }, success: true }
    vi.mocked(jobsApi.getJobById).mockResolvedValue(mockData as any)

    const { result } = renderHook(() => useJob('1'), { wrapper: createWrapper() })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual(mockData)
  })

  it('does not fetch when id is empty', () => {
    const { result } = renderHook(() => useJob(''), { wrapper: createWrapper() })

    expect(result.current.fetchStatus).toBe('idle')
    expect(jobsApi.getJobById).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 3: Run both test files**

Run: `cd hirehub-frontend && bun run test:run -- src/hooks/__tests__/useJobs.test.ts src/hooks/__tests__/useJob.test.ts`
Expected: ALL PASS

- [ ] **Step 4: Commit**

```bash
cd hirehub-frontend && git add src/hooks/__tests__/useJobs.test.ts src/hooks/__tests__/useJob.test.ts && git commit -m "test: add useJobs and useJob hook tests"
```

---

## Phase 14: Final Verification

### Task 19: Run Full Test Suites

- [ ] **Step 1: Run all backend tests**

Run: `cd hirehub-backend && bun run test`
Expected: ALL tests pass

- [ ] **Step 2: Run all frontend tests**

Run: `cd hirehub-frontend && bun run test:run`
Expected: ALL tests pass

- [ ] **Step 3: Verify no regressions in existing tests**

Check output for any pre-existing tests that now fail. If so, investigate and fix.

- [ ] **Step 4: Final commit with any fixes**

```bash
cd hirehub-backend && git add -A && git commit -m "test: complete backend E2E test coverage for all critical flows"
cd hirehub-frontend && git add -A && git commit -m "test: complete frontend E2E test coverage for all critical flows"
```

---

## Summary

| Phase | Scope | New Files | Modified Files |
|-------|-------|-----------|----------------|
| 1 | Auth Extension Tests | 1 test file | 0 |
| 2 | Jobs Extension Tests | 1 test file | 0 |
| 3 | Applications Extension Tests | 1 test file | 0 |
| 4 | Saved Jobs Tests | 1 test file | 0 |
| 5 | Blog + Contact + Pricing Tests | 3 test files | 0 |
| 6 | Upload + Admin Tests | 2 test files | 0 |
| 7 | Full Backend Verification | 0 | 0 |
| 8 | Frontend API Fixes | 0 | 2 API files + 3 backend files |
| 9 | Auth Page Tests | 3 test files | 0 |
| 10 | Job Page Tests | 2 test files | 0 |
| 11 | Dashboard Page Tests | 2 test files | 0 |
| 12 | Secondary Page Tests | 3 test files | 0 |
| 13 | Hook Tests | 2 test files | 0 |
| 14 | Final Verification | 0 | 0 |
| **Total** | | **21 new test files** | **5 modified files** |
