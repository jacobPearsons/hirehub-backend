# Screening Questions + ATS Pipeline Kanban — Implementation Plan

- Date: 2026-08-11
- Repos: `hirehub-backend`, `hirehub-frontend`
- Source of truth: `docs/superpowers/specs/2026-08-11-screening-ats-kanban-design.md` (committed `55c4434`)
- Method: TDD. Every task = write failing test(s) → run and confirm red → minimal implementation → run and confirm green → commit.

## Overview

Employers add screening questions to jobs. Seekers answer them when applying. A pure keyword-overlap engine scores answers deterministically (requirements + tags vs cover letter, per-question expected keywords vs answer). The ApplicationStatus enum grows to `APPLIED, SCREENING, SHORTLIST, INTERVIEWING, OFFER, HIRED, REJECTED, WITHDRAWN` (`REVIEWING` → `SCREENING`, data-migrated). Employers get a drag-and-drop Kanban pipeline tab (dnd-kit) with a legal-transition matrix enforced on both client (optimistic gating) and server (400 on violation). Every status change appends a timeline entry and pushes an SSE `application:updated` event to the job's employer so open pipelines stay live. Also fixes a latent RBAC bug: registration never created a RoleBinding, so fresh employers were denied `application:update`.

## Conventions & Global Constraints

- Strict TDD. No implementation before the failing test is confirmed red.
- No code comments unless asked. Follow existing code style in the file being edited.
- Backend tests: `npx vitest run` (from `hirehub-backend`) — DB-backed supertest against the live app, `.env.test`. Run a single file with `npx vitest run src/tests/<file>.test.ts`.
- Frontend tests: `npm run test:run`; gate each frontend milestone with `npm run lint` and `npm run build` too.
- Prisma: edit `prisma/schema.prisma`, then `npx prisma migrate dev --name <name>` (applies to dev DB + regenerates client). To keep the test DB in sync: `DATABASE_URL=$(sed -n 's/^DATABASE_URL=//p' .env.test) npx prisma migrate deploy`.
- Wire statuses are UPPERCASE on the backend (`SCREENING`), lowercase in the frontend union (`'screening'`). `STATUS_TO_UPPER` maps.
- Stage only intended files in each commit. Never commit unrelated WIP (see "Pre-existing WIP" below). Never modify unrelated files.
- Clean up test fixtures in `afterAll` (users/jobs/applications), matching existing test-file patterns.
- Milestones are additive; existing tests must stay green. Tasks tagged `(sweep)` intentionally change existing test expectations where behavior was wrong/renamed.

### Pre-existing WIP (backend)

The backend repo has an in-progress, uncommitted "random sort + remote jobs seed" feature touching `src/config/swagger.ts`, `src/modules/jobs/jobs.query.ts`, `src/modules/jobs/jobs.service.ts`, `src/prisma/seed.ts`, and 3 jobs test files. M1 and M3 edit `swagger.ts` and `jobs.service.ts`. **Before starting M1, ask the user how to handle this WIP** (commit it separately, or stash it). Keep its hunks out of our commits.

## Milestone → Task Map

| Milestone | Tasks | Verify |
|---|---|---|
| M0 RBAC auto-binding | 0.1–0.5 | backend tests |
| M1 Status enum + models | 1.1 enum + data migration + sweep, 1.2 4 new models | backend tests |
| M2 ScreeningEngine | 2.1 pure unit tests | backend tests |
| M3 Jobs screening questions API | 3.1 create, 3.2 update replace, 3.3 validation | backend tests |
| M4 Applications pipeline API | 4.1 matrix + routes, 4.2 create+scoring, 4.3 detail+timeline, 4.4 withdraw, 4.5 emails sweep | backend tests |
| M5 Frontend types + API + status sweep | 5.1 types, 5.2 api client, 5.3 status sweep | frontend tests/lint/build |
| M6 PostJobForm editor | 6.1 editor, 6.2 tests | frontend tests |
| M7 ApplyJobForm questions | 7.1 dynamic questions, 7.2 tests | frontend tests |
| M8 PipelineTab Kanban | 8.1 moveCard util + matrix, 8.2 tab UI, 8.3 tests | frontend tests |
| M9 Drawer enrichment | 9.1 screening + timeline sections, 9.2 tests | frontend tests |
| M10 Realtime stream | 10.1 event subscription, 10.2 tests | frontend tests |

---

## M0 — RBAC auto-binding fix

**Context:** `src/modules/auth/auth.service.ts` `register()` creates user + refresh token but no `RoleBinding`, so fresh EMPLOYERs get `DENY reason:'NO_BINDINGS'` on `application:update` (the PATCH status route). `ensureDefaultRoles()` (`src/modules/rbac/ensure-default-roles.ts`) upserts default roles without overwriting; `src/modules/rbac/default-roles.ts` exports `DEFAULT_ROLES` with ids `employer` / `seeker`.

### Task 0.1 — new test `src/tests/rbac-auto-binding.test.ts` (red)

```ts
import { describe, it, expect, afterAll } from 'vitest'
import request from 'supertest'
import app from '../app/app'
import { prisma } from '../lib/prisma'

describe('RBAC auto-binding on registration', () => {
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { contains: 'autobind' } } })
  })

  it('binds a freshly-registered EMPLOYER to the default employer role', async () => {
    const email = `autobind-emp-${Date.now()}@example.com`
    await request(app)
      .post('/api/auth/register')
      .send({ name: 'AutoBind Employer', email, password: 'password123', role: 'EMPLOYER' })
      .expect(201)

    const user = await prisma.user.findUnique({ where: { email } })
    expect(user).not.toBeNull()
    const binding = await prisma.roleBinding.findFirst({ where: { userId: user!.id, roleId: 'employer' } })
    expect(binding).not.toBeNull()
    expect(binding!.contextType).toBe('global')
  })

  it('binds a freshly-registered SEEKER to the default seeker role', async () => {
    const email = `autobind-seeker-${Date.now()}@example.com`
    await request(app)
      .post('/api/auth/register')
      .send({ name: 'AutoBind Seeker', email, password: 'password123', role: 'SEEKER' })
      .expect(201)

    const user = await prisma.user.findUnique({ where: { email } })
    expect(user).not.toBeNull()
    const binding = await prisma.roleBinding.findFirst({ where: { userId: user!.id, roleId: 'seeker' } })
    expect(binding).not.toBeNull()
  })
})
```

Confirm red (`npx vitest run src/tests/rbac-auto-binding.test.ts`).

### Task 0.2 — implement in `src/modules/auth/auth.service.ts`

- Import `ensureDefaultRoles` from `../rbac/ensure-default-roles`.
- In `register()`, before the `$transaction`, `await ensureDefaultRoles()`.
- Inside the transaction, after `user` is created, look up the default role and bind:

```ts
const defaultRoleId = user.role === 'EMPLOYER' ? 'employer' : 'seeker'
const defaultRole = await tx.role.findUnique({ where: { id: defaultRoleId } })
if (defaultRole) {
  await tx.roleBinding.create({
    data: { userId: user.id, roleId: defaultRole.id, contextType: 'global', grantedBy: user.id },
  })
}
```

Confirm green.

### Task 0.3 — `(sweep)` update `src/tests/auth-permissions.test.ts`

Replace the final test "returns [] for an EMPLOYER with no bindings" (fresh employers now have default bindings) with:

```ts
it('returns default employer capabilities for a freshly-registered EMPLOYER', async () => {
  const token = await register('Perm Employer Default', 'EMPLOYER', 'perm-default')
  const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`).expect(200)
  expect(res.body.data.permissions).toEqual(expect.arrayContaining(['job:create', 'application:update']))
})
```

Run the whole file → green. (The existing "binding capabilities for an EMPLOYER" test still passes: `arrayContaining`.)

### Task 0.4 — `(sweep)` `src/tests/applications-hiring-flow.test.ts`

The owning employer was previously blocked by the RBAC bug; now allowed. Update the two tests:
- "forbids the owning EMPLOYER from updating status" → "allows the owning EMPLOYER to update status": send `{ status: 'INTERVIEWING' }`, expect `200`, assert `res.body.data.status` toBe `'INTERVIEWING'`. (INTERVIEWING stays valid through M1 and satisfies the M4 matrix from this point in the file's execution order — the admin test before it moves the app to REVIEWING→SCREENING.)
- "forbids the owning EMPLOYER from updating hiring data" → "allows the owning EMPLOYER to update hiring data": keep body, expect `200`, assert `res.body.data.hiringData` is defined.

Run file → green.

### Task 0.5 — `(sweep)` `src/tests/applications.test.ts`

- "should forbid the employer from updating status" → "should allow the owning employer to update status": send `{ status: 'INTERVIEWING' }`, expect `200`.

Run file → green. Commit: `fix: auto-bind default roles on registration`.

---

## M1 — Status enum + Screening models

### Task 1.1 — enum: `REVIEWING` → `SCREENING` + add `SHORTLIST`, `HIRED`, `WITHDRAWN` (red)

1. Write failing tests first. Change these existing tests to use `SCREENING` (currently 400/unknown → red):
   - `src/tests/applications-hiring-flow.test.ts` admin test: `.send({ status: 'SCREENING' })`, expect `.data.status` toBe `'SCREENING'`.
   - `src/tests/applications.test.ts` employer test: `'SCREENING'`, expect `200`.
   - `src/tests/notifications.test.ts` (~line 222): `'SCREENING'`.
   - `src/tests/email-templates.test.ts` (~line 100): `renderStatusEmail(..., 'SCREENING')`.
   - `src/tests/email-triggers.test.ts`: test "routes other transitions…" → `updateStatus(applicationId, 'SCREENING', 'any-user', 'ADMIN')`, expect `'SCREENING'`. (Order will be reworked in M4; enum-only change here.)
2. Confirm red.
3. Implement:
   - `prisma/schema.prisma` — `ApplicationStatus` enum:
     ```prisma
     enum ApplicationStatus {
       APPLIED
       SCREENING
       SHORTLIST
       INTERVIEWING
       OFFER
       HIRED
       REJECTED
       WITHDRAWN
     }
     ```
   - `npx prisma migrate dev --name screening_status_enum` — verify the generated `prisma/migrations/<ts>_screening_status_enum/migration.sql` contains:
     ```sql
     ALTER TYPE "ApplicationStatus" RENAME VALUE 'REVIEWING' TO 'SCREENING';
     ALTER TYPE "ApplicationStatus" ADD VALUE IF NOT EXISTS 'SHORTLIST' AFTER 'SCREENING';
     ALTER TYPE "ApplicationStatus" ADD VALUE IF NOT EXISTS 'HIRED' AFTER 'OFFER';
     ALTER TYPE "ApplicationStatus" ADD VALUE IF NOT EXISTS 'WITHDRAWN' AFTER 'REJECTED';
     ```
     (Edit the migration SQL to match if Prisma generated it differently.) Then sync the test DB: `DATABASE_URL=$(sed -n 's/^DATABASE_URL=//p' .env.test) npx prisma migrate deploy`.
   - `src/modules/applications/applications.routes.ts` (~line 23): status schema → `z.enum(['APPLIED', 'SCREENING', 'SHORTLIST', 'INTERVIEWING', 'OFFER', 'HIRED', 'REJECTED', 'WITHDRAWN'])`.
   - `src/config/swagger.ts` (~lines 58, 349): update both `status` enum arrays (only our lines; the file carries unrelated WIP — see constraints).
   - `src/services/email/templates.ts`: rename the `REVIEWING` key → `SCREENING` (copy: "Application under review" → "Application under screening"). New status copy entries (SHORTLIST, HIRED, WITHDRAWN) land in M4.
4. Confirm green. Commit: `feat: expand ApplicationStatus enum with SCREENING/SHORTLIST/HIRED/WITHDRAWN`.

### Task 1.2 — models: `ScreeningQuestion`, `ScreeningAnswer`, `ScreeningResult`, `ApplicationTimelineEntry` (red)

1. Write `src/tests/screening-models.test.ts` first (red — types don't exist yet, file won't compile):

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '../lib/prisma'

describe('Screening + timeline models', () => {
  let employerId = ''
  let seekerId = ''
  let jobId = ''
  let applicationId = ''

  beforeAll(async () => {
    const employer = await prisma.user.create({
      data: { name: 'Smoke Employer', email: `smoke-emp-${Date.now()}@example.com`, passwordHash: 'x', role: 'EMPLOYER', companyName: 'Smoke Co' },
    })
    const seeker = await prisma.user.create({
      data: { name: 'Smoke Seeker', email: `smoke-seeker-${Date.now()}@example.com`, passwordHash: 'x', role: 'SEEKER' },
    })
    employerId = employer.id
    seekerId = seeker.id
    const job = await prisma.job.create({
      data: {
        title: 'Smoke Job', company: 'Smoke Co', location: 'Remote', remote: true,
        category: 'Engineering', seniority: 'Junior', description: 'Test',
        requirements: ['Python'], responsibilities: ['Code'], tags: ['python'],
        employerId: employer.id,
        screeningQuestions: { create: [{ prompt: 'Years of Python?', expectedKeywords: ['python'], maxScore: 10, order: 1 }] },
      },
    })
    jobId = job.id
    const question = job.screeningQuestions[0]
    const application = await prisma.application.create({
      data: {
        jobId, userId: seeker.id, applicantName: 'Smoke Seeker', applicantEmail: `smoke-app-${Date.now()}@example.com`,
        coverLetter: 'I know python',
        screeningAnswers: { create: [{ questionId: question.id, answerText: '5 years python', score: 8, matchedKeywords: ['python'] }] },
        screeningResult: { create: { score: 8, maxPossible: 10 } },
        timeline: { create: { toStatus: 'APPLIED', actorRole: 'SEEKER' } },
      },
    })
    applicationId = application.id
  }, 30_000)

  afterAll(async () => {
    await prisma.application.deleteMany({ where: { id: applicationId } })
    await prisma.job.deleteMany({ where: { id: jobId } })
    await prisma.user.deleteMany({ where: { id: { in: [employerId, seekerId] } } })
  })

  it('persists questions, answers, result, and timeline with relations', async () => {
    const job = await prisma.job.findUnique({ where: { id: jobId }, include: { screeningQuestions: true } })
    expect(job?.screeningQuestions).toHaveLength(1)
    expect(job?.screeningQuestions[0].prompt).toBe('Years of Python?')

    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      include: { screeningAnswers: true, screeningResult: true, timeline: true },
    })
    expect(application?.screeningAnswers).toHaveLength(1)
    expect(application?.screeningAnswers[0].score).toBe(8)
    expect(application?.screeningResult?.score).toBe(8)
    expect(application?.timeline).toHaveLength(1)
    expect(application?.timeline[0].toStatus).toBe('APPLIED')
  })
})
```

2. Confirm red (compile failure).
3. Implement in `prisma/schema.prisma` (plus back-relations on `Job` and `Application`):

```prisma
model ScreeningQuestion {
  id               String             @id @default(cuid())
  jobId            String
  job              Job                @relation(fields: [jobId], references: [id], onDelete: Cascade)
  prompt           String
  expectedKeywords String[]
  maxScore         Int                @default(5)
  order            Int
  createdAt        DateTime           @default(now())
  answers          ScreeningAnswer[]

  @@index([jobId, order])
  @@map("ScreeningQuestion")
}

model ScreeningAnswer {
  id            String             @id @default(cuid())
  applicationId String
  application   Application        @relation(fields: [applicationId], references: [id], onDelete: Cascade)
  questionId    String
  question      ScreeningQuestion  @relation(fields: [questionId], references: [id], onDelete: Cascade)
  answerText    String
  score         Int?
  matchedKeywords String[]
  createdAt     DateTime           @default(now())

  @@unique([applicationId, questionId])
  @@index([questionId])
  @@map("ScreeningAnswer")
}

model ScreeningResult {
  id            String       @id @default(cuid())
  applicationId String       @unique
  application   Application  @relation(fields: [applicationId], references: [id], onDelete: Cascade)
  score         Int
  maxPossible   Int
  createdAt     DateTime     @default(now())
  @@map("ScreeningResult")
}

model ApplicationTimelineEntry {
  id              String             @id @default(cuid())
  applicationId   String
  application     Application        @relation(fields: [applicationId], references: [id], onDelete: Cascade)
  fromStatus      ApplicationStatus?
  toStatus        ApplicationStatus
  actorRole       UserRole
  changedByUserId String?
  createdAt       DateTime           @default(now())

  @@index([applicationId, createdAt])
  @@map("ApplicationTimelineEntry")
}
```

- `Job` gets `screeningQuestions ScreeningQuestion[]`.
- `Application` gets `screeningAnswers ScreeningAnswer[]`, `screeningResult ScreeningResult?`, `timeline ApplicationTimelineEntry[]`.
- Run `npx prisma migrate dev --name screening_ats_models` + sync test DB as in 1.1.
4. Confirm green. Commit: `feat: add screening and timeline models`.

---

## M2 — ScreeningEngine (pure)

**New file:** `src/modules/screening/screeningEngine.ts` — pure functions, no DB, no I/O.

### Task 2.1 — tests `src/tests/screening-engine.test.ts` (red)

```ts
import { describe, it, expect } from 'vitest'
import { normalizeTokens, keywordOverlap, scoreAnswer, scoreApplication } from '../modules/screening/screeningEngine'

describe('ScreeningEngine', () => {
  it('normalizes and dedupes tokens, dropping stopwords and short words', () => {
    expect(normalizeTokens('Python and React AND python!')).toEqual(['python', 'react'])
  })

  it('computes keyword overlap ratio', () => {
    expect(keywordOverlap(['Python', 'React'], 'I know Python well')).toEqual({ matched: ['python'], ratio: 0.5 })
  })

  it('scores an answer proportionally to maxScore', () => {
    expect(scoreAnswer(['python', 'react'], 10, 'I use python daily')).toEqual({ score: 5, matchedKeywords: ['python'] })
  })

  it('never scores above maxScore for a multi-token keyword', () => {
    expect(scoreAnswer(['react native'], 10, 'I know react and native well')).toEqual({ score: 10, matchedKeywords: ['react', 'native'] })
  })

  it('scores a full application from requirements, tags, cover letter and answers', () => {
    const result = scoreApplication({
      requirements: ['Python', 'FastAPI'],
      tags: ['backend'],
      coverLetter: 'I build APIs with Python',
      questions: [
        { id: 'q1', prompt: 'Years of Python?', expectedKeywords: ['python'], maxScore: 5 },
        { id: 'q2', prompt: 'FastAPI experience?', expectedKeywords: ['fastapi'], maxScore: 5 },
      ],
      answers: [
        { questionId: 'q1', answerText: 'Five years of python' },
        { questionId: 'q2', answerText: 'No' },
      ],
    })
    expect(result.maxPossible).toBe(13)
    expect(result.score).toBe(6) // cover-letter keyword (1) + q1 (5) + q2 (0)
    expect(result.answers).toEqual([
      { questionId: 'q1', score: 5, matchedKeywords: ['python'] },
      { questionId: 'q2', score: 0, matchedKeywords: [] },
    ])
  })
})
```

### Task 2.2 — implement

```ts
export interface ScreeningAnswerInput {
  questionId: string
  answerText: string
}

export interface ScreeningQuestionInput {
  id: string
  prompt: string
  expectedKeywords: string[]
  maxScore: number
}

export interface ScreeningScore {
  score: number
  maxPossible: number
  answers: { questionId: string; score: number; matchedKeywords: string[] }[]
  keywordMatched: string[]
}

const STOPWORDS = new Set(['the', 'and', 'for', 'with', 'that', 'this', 'have', 'you', 'your', 'are', 'was', 'not', 'but', 'its', 'has', 'had', 'from', 'will', 'would', 'can', 'all', 'our', 'per'])

export function normalizeTokens(text: string): string[] {
  return [...new Set(
    text.toLowerCase()
      .split(/[^a-z0-9+#.]+/)
      .map((t) => t.trim())
      .filter((t) => t.length >= 3 && !STOPWORDS.has(t)),
  )]
}

export function keywordOverlap(expected: string[], text: string): { matched: string[]; ratio: number } {
  const expectedTokens = expected.flatMap((kw) => normalizeTokens(kw))
  const candidateTokens = new Set(normalizeTokens(text))
  const matched = [...new Set(expectedTokens.filter((t) => candidateTokens.has(t)))]
  if (expectedTokens.length === 0) return { matched: [], ratio: 0 }
  return { matched, ratio: matched.length / expectedTokens.length }
}

export function scoreAnswer(expectedKeywords: string[], maxScore: number, answerText: string): { score: number; matchedKeywords: string[] } {
  const { matched, ratio } = keywordOverlap(expectedKeywords, answerText)
  return { score: Math.round(ratio * maxScore), matchedKeywords: matched }
}

export function scoreApplication(input: {
  requirements: string[]
  tags: string[]
  coverLetter: string
  questions: ScreeningQuestionInput[]
  answers: ScreeningAnswerInput[]
}): ScreeningScore {
  const expected = [...input.requirements, ...input.tags].filter(Boolean)
  const { matched } = keywordOverlap(expected, input.coverLetter)
  const byQuestion = new Map(input.answers.map((a) => [a.questionId, a]))
  const answers = input.questions.map((q) => {
    const answer = byQuestion.get(q.id)
    return answer
      ? { questionId: q.id, ...scoreAnswer(q.expectedKeywords, q.maxScore, answer.answerText) }
      : { questionId: q.id, score: 0, matchedKeywords: [] }
  })
  const score = matched.length + answers.reduce((sum, a) => sum + a.score, 0)
  const maxPossible = expected.length + input.questions.reduce((sum, q) => sum + q.maxScore, 0)
  return { score, maxPossible, answers, keywordMatched: matched }
}
```

Confirm green. Commit: `feat: add pure screening scoring engine`.

---

## M3 — Jobs screening questions API

**Files:** `src/modules/jobs/jobs.routes.ts`, `src/modules/jobs/jobs.service.ts`, `src/modules/jobs/jobs.repository.ts`. Read these three files fully first.

**Wanted shape (route schemas):**

```ts
const screeningQuestionSchema = z.object({
  prompt: z.string().min(1).max(500),
  expectedKeywords: z.array(z.string().max(50)).default([]),
  maxScore: z.number().int().min(1).max(100).default(5),
  order: z.number().int().min(0).optional(),
})

// in createJobSchema and updateJobSchema:
screeningQuestions: z.array(screeningQuestionSchema).optional(),
```

### Task 3.1 — create job with screening questions (red → green)

New `src/tests/jobs-screening.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import app from '../app/app'
import { prisma } from '../lib/prisma'

let employerToken = ''
let employerEmail = ''
let jobId = ''

describe('Jobs screening questions API', () => {
  beforeAll(async () => {
    employerEmail = `jobscreen-emp-${Date.now()}@example.com`
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'JobScreen Employer', email: employerEmail, password: 'password123', role: 'EMPLOYER' })
    employerToken = res.body.data.accessToken
  })

  afterAll(async () => {
    if (jobId) await prisma.job.deleteMany({ where: { id: jobId } })
    await prisma.user.deleteMany({ where: { email: employerEmail } })
  })

  it('creates a job with screening questions, auto-assigning order', async () => {
    const res = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${employerToken}`)
      .send({
        title: 'Screening Job', company: 'Scr Co', location: 'Remote', remote: true,
        category: 'Engineering', seniority: 'Junior', description: 'Test',
        requirements: ['Python'], responsibilities: ['Code'], tags: ['python'],
        screeningQuestions: [
          { prompt: 'Years of Python?', expectedKeywords: ['python'], maxScore: 10 },
          { prompt: 'Describe a tricky bug', expectedKeywords: [], maxScore: 5 },
        ],
      })
      .expect(201)

    expect(res.body.data.screeningQuestions).toHaveLength(2)
    expect(res.body.data.screeningQuestions[0].order).toBe(1)
    expect(res.body.data.screeningQuestions[1].order).toBe(2)
    jobId = res.body.data.id
  })

  it('rejects screening questions with an empty prompt', async () => {
    const res = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${employerToken}`)
      .send({
        title: 'Bad Question Job', company: 'Scr Co', location: 'Remote', remote: true,
        category: 'Engineering', seniority: 'Junior', description: 'Test',
        requirements: ['Python'], responsibilities: ['Code'], tags: ['python'],
        screeningQuestions: [{ prompt: '', expectedKeywords: ['x'], maxScore: 5 }],
      })
      .expect(400)
    expect(res.body.success).toBe(false)
  })
})
```

Implementation:
- `jobs.repository.ts`: in `create`, `update`, and `findById`, include `screeningQuestions: { orderBy: { order: 'asc' } }`.
- `jobs.service.ts` `createJob`: when `screeningQuestions` is provided, pass `screeningQuestions: { create: questions.map((q, i) => ({ prompt: q.prompt, expectedKeywords: q.expectedKeywords, maxScore: q.maxScore, order: q.order ?? i + 1 })) }` into the repo create data.

### Task 3.2 — transactional replace on update (red → green)

Add to `src/tests/jobs-screening.test.ts`:

```ts
it('replaces screening questions on update', async () => {
  const res = await request(app)
    .patch(`/api/jobs/${jobId}`)
    .set('Authorization', `Bearer ${employerToken}`)
    .send({
      screeningQuestions: [
        { prompt: 'Only one now', expectedKeywords: ['one'], maxScore: 3 },
      ],
    })
    .expect(200)

  expect(res.body.data.screeningQuestions).toHaveLength(1)
  expect(res.body.data.screeningQuestions[0].prompt).toBe('Only one now')
  expect(res.body.data.screeningQuestions[0].order).toBe(1)
})
```

Implementation in `jobs.service.ts` `updateJob`: when `screeningQuestions` is present in the payload, run the update inside `prisma.$transaction`:

```ts
const { screeningQuestions, ...rest } = payload
const data: Prisma.JobUpdateInput = { ...rest }
if (screeningQuestions) {
  data.screeningQuestions = {
    deleteMany: {},
    create: screeningQuestions.map((q, i) => ({
      prompt: q.prompt,
      expectedKeywords: q.expectedKeywords,
      maxScore: q.maxScore,
      order: q.order ?? i + 1,
    })),
  }
}
```

(Read the current `updateJob`/repository signature and adapt; keep `updateJobSchema` permitting partial updates — omitting `screeningQuestions` leaves them untouched.)

Run the full jobs test files + `jobs-screening.test.ts` → green. Commit: `feat: support screening questions on job create/update`.

---

## M4 — Applications pipeline API

**Files:** `src/modules/applications/applications.routes.ts`, `applications.service.ts`, `applications.repository.ts`, `src/services/sse.ts` (import only), `src/services/email/templates.ts` (status copy).

**New shared module** `src/modules/applications/status-transitions.ts`:

```ts
import type { ApplicationStatus } from '@prisma/client'

export const ALLOWED_TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  APPLIED: ['SCREENING', 'SHORTLIST', 'REJECTED', 'WITHDRAWN'],
  SCREENING: ['SHORTLIST', 'INTERVIEWING', 'REJECTED', 'WITHDRAWN', 'APPLIED'],
  SHORTLIST: ['INTERVIEWING', 'OFFER', 'REJECTED', 'WITHDRAWN'],
  INTERVIEWING: ['OFFER', 'REJECTED', 'WITHDRAWN'],
  OFFER: ['HIRED', 'REJECTED', 'WITHDRAWN'],
  HIRED: [],
  REJECTED: [],
  WITHDRAWN: [],
}

export function canTransition(from: ApplicationStatus, to: ApplicationStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false
}
```

### Task 4.1 — transition matrix + status route hardening (red → green)

New `src/tests/status-transitions.test.ts` (pure, mirrors engine test style): assert each row of the matrix and that `canTransition` is false for illegal pairs (`APPLIED→OFFER`, `OFFER→SCREENING`, `HIRED→REJECTED`, `REJECTED→HIRED`).

Then in `src/tests/screening-pipeline.test.ts` (new, full-flow — this is the M4 backbone; extend it in 4.2–4.4):

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import app from '../app/app'
import { prisma } from '../lib/prisma'

let employerToken = ''
let seekerToken = ''
let jobId = ''
let applicationId = ''
let withdrawApplicationId = ''
const emails: string[] = []

async function register(name: string, role: 'EMPLOYER' | 'SEEKER') {
  const email = `pipeline-${role.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`
  emails.push(email)
  const res = await request(app).post('/api/auth/register').send({ name, email, password: 'password123', role })
  return res.body.data.accessToken as string
}

describe('Screening + ATS pipeline', () => {
  beforeAll(async () => {
    employerToken = await register('Pipeline Employer', 'EMPLOYER')
    seekerToken = await register('Pipeline Seeker', 'SEEKER')
    const jobRes = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${employerToken}`)
      .send({
        title: 'Pipeline Job', company: 'Pipeline Co', location: 'Remote', remote: true,
        category: 'Engineering', seniority: 'Junior', description: 'Test',
        requirements: ['Python'], responsibilities: ['Code'], tags: ['python'],
        screeningQuestions: [
          { prompt: 'Years of Python?', expectedKeywords: ['python'], maxScore: 10 },
          { prompt: 'FastAPI?', expectedKeywords: ['fastapi'], maxScore: 5 },
        ],
      })
      .expect(201)
    jobId = jobRes.body.data.id
  }, 30_000)

  afterAll(async () => {
    if (applicationId) await prisma.application.deleteMany({ where: { id: applicationId } })
    if (withdrawApplicationId) await prisma.application.deleteMany({ where: { id: withdrawApplicationId } })
    if (jobId) await prisma.job.deleteMany({ where: { id: jobId } })
    await prisma.user.deleteMany({ where: { email: { in: emails } } })
  })

  it('scores a screening application at submit time', async () => {
    const res = await request(app)
      .post('/api/applications')
      .set('Authorization', `Bearer ${seekerToken}`)
      .send({
        jobId,
        applicantName: 'Pipeline Seeker',
        applicantEmail: emails[1],
        coverLetter: 'I build APIs with Python',
        screeningAnswers: [
          { questionId: jobQuestions[0].id, answerText: 'Five years of python' },
          { questionId: jobQuestions[1].id, answerText: 'I have used FastAPI in production' },
        ],
      })
      .expect(201)

    applicationId = res.body.data.id
    expect(res.body.data.status).toBe('APPLIED')
    expect(res.body.data.screeningResult.score).toBe(16) // cover 'python' (1) + 10 + 5
    expect(res.body.data.screeningResult.maxPossible).toBe(17) // 2 keyword rows (requirements+tags) + 15
    expect(res.body.data.screeningAnswers).toHaveLength(2)
  })
})
```

(The test needs the screening question ids: store the created job's `screeningQuestions` in a module-scope `let questions: { id: string }[] = []`, assign it in `beforeAll` (`questions = jobRes.body.data.screeningQuestions`), and use `questions[0].id` / `questions[1].id` in the POST body.)

Implementation:
- `applications.routes.ts` POST `/applications` apply schema: add `screeningAnswers: z.array(z.object({ questionId: z.string(), answerText: z.string().min(1).max(5000) })).optional()`.
- `applications.service.ts` `create(data, userId)`: load job with `include: { screeningQuestions: { orderBy: { order: 'asc' } } }`; if the job has questions, validate every `questionId` belongs to the job (else `ValidationError`); compute `scoreApplication(...)`; persist nested `screeningAnswers` (each with `score` + `matchedKeywords` from the engine result) + `screeningResult` + timeline entry `{ toStatus: 'APPLIED', actorRole: 'SEEKER' }`; then `sendToUser(job.employerId, 'application:updated', { applicationId: application.id, jobId, status: 'APPLIED' })` (import `sendToUser` from `../../services/sse`).
- `applications.repository.ts` `create`/`findById`/`findByJob`/`findByUser`: include `screeningQuestions`/`screeningAnswers` (with `question`), `screeningResult`, and `timeline` where useful (see 4.3).

### Task 4.2 — status updates enforce the matrix + SSE + timeline (red → green)

Extend `screening-pipeline.test.ts`:

```ts
it('moves an application through the full legal pipeline', async () => {
  const steps = ['SCREENING', 'SHORTLIST', 'INTERVIEWING', 'OFFER', 'HIRED']
  for (const next of steps) {
    const res = await request(app)
      .patch(`/api/applications/${applicationId}/status`)
      .set('Authorization', `Bearer ${employerToken}`)
      .send({ status: next })
      .expect(200)
    expect(res.body.data.status).toBe(next)
  }
})

it('rejects illegal transitions with 400', async () => {
  const res = await request(app)
    .patch(`/api/applications/${applicationId}/status`)
    .set('Authorization', `Bearer ${employerToken}`)
    .send({ status: 'OFFER' }) // HIRED -> OFFER illegal
    .expect(400)
  expect(res.body.success).toBe(false)
})
```

Implementation in `applications.service.ts` `updateStatus`:
- Type `status` as `ApplicationStatus`; before updating, `if (!canTransition(application.status, status)) throw new ValidationError(...)`.
- Reject `status === 'WITHDRAWN'` with `ValidationError('Use the withdraw endpoint for candidate withdrawals')` (withdraw is candidate-initiated).
- After `repo.updateStatus`, create a timeline entry `{ applicationId, fromStatus: application.status, toStatus: status, actorRole: userRole === 'ADMIN' ? 'ADMIN' : 'EMPLOYER', changedByUserId: userId }`.
- Keep the existing email + seeker-notification behaviour.
- Add `sendToUser(application.job.employerId, 'application:updated', { applicationId: application.id, jobId: application.jobId, status })` after the update.

Also `(sweep)` in `src/tests/applications-hiring-flow.test.ts` (granted block): the "allows the owning granted EMPLOYER to update status" test sends `INTERVIEWING` from `APPLIED`, which the M4 matrix now rejects with 400. Change it to send `SCREENING` (APPLIED→SCREENING is legal) and assert `res.body.data.status` toBe `'SCREENING'`. Run that file → green.

### Task 4.3 — detail endpoint with timeline (red → green)

Extend `screening-pipeline.test.ts`:

```ts
it('returns the application with timeline and screening details to the owning employer', async () => {
  const res = await request(app)
    .get(`/api/applications/${applicationId}`)
    .set('Authorization', `Bearer ${employerToken}`)
    .expect(200)

  expect(res.body.data.status).toBe('HIRED')
  expect(res.body.data.timeline.length).toBeGreaterThanOrEqual(6) // APPLIED + 5 transitions
  expect(res.body.data.timeline[0].toStatus).toBe('APPLIED')
  expect(res.body.data.screeningResult.score).toBe(16)
  expect(res.body.data.screeningAnswers[0].question.prompt).toBe('Years of Python?')
})

it('forbids a non-owner seeker from viewing another application', async () => {
  const other = await request(app).post('/api/auth/register')
    .send({ name: 'Other Seeker', email: `other-${Date.now()}@example.com`, password: 'password123', role: 'SEEKER' })
  emails.push(other.body.data.user.email)
  await request(app)
    .get(`/api/applications/${applicationId}`)
    .set('Authorization', `Bearer ${other.body.data.accessToken}`)
    .expect(403)
})
```

(Check the register response shape and use the right field for the user email — adjust `emails.push(...)` accordingly.)

Implementation:
- `applications.routes.ts`: add `router.get('/:id', requireAuth, (req, res) => controller.getById(req, res))` — register AFTER `/candidate`/list routes.
- `applications.controller.ts`: `getById` → `service.getById(id, req.user.id, req.user.role)`.
- `applications.service.ts` `getById(id, userId, userRole)`: load via `repo.findById` (with timeline + screening includes); authorize seeker (owner), employer (owning job), or ADMIN; return the application.
- `applications.repository.ts` `findById`: include `screeningResult`, `screeningAnswers: { include: { question: true } }`, `timeline: { orderBy: { createdAt: 'asc' } }`.

### Task 4.4 — withdraw (red → green)

Extend `screening-pipeline.test.ts`:

```ts
it('lets a seeker withdraw a non-terminal application', async () => {
  const res = await request(app)
    .post(`/api/applications/${withdrawApplicationId}/withdraw`)
    .set('Authorization', `Bearer ${seekerToken}`)
    .expect(200)
  expect(res.body.data.status).toBe('WITHDRAWN')

  const again = await request(app)
    .post(`/api/applications/${withdrawApplicationId}/withdraw`)
    .set('Authorization', `Bearer ${seekerToken}`)
    .expect(400)
  expect(again.body.success).toBe(false)
})
```

(`withdrawApplicationId` is created in the 4.1 submit-style test — create a second application with answers in this task's red test so the flow exists: POST `/api/applications` as seeker, then withdraw.)

Implementation:
- `applications.routes.ts`: `POST /applications/:id/withdraw` (requireAuth; controller enforces SEEKER ownership).
- `applications.service.ts` `withdraw(id, userId)`: load; `if (application.userId !== userId) throw AuthorizationError`; `if (!canTransition(application.status, 'WITHDRAWN')) throw ValidationError('This application can no longer be withdrawn')`; `repo.updateStatus(id, 'WITHDRAWN')`; timeline entry `{ toStatus: 'WITHDRAWN', fromStatus: application.status, actorRole: 'SEEKER', changedByUserId: userId }`; `sendToUser(application.job.employerId, 'application:updated', { applicationId: application.id, jobId: application.jobId, status: 'WITHDRAWN' })`. No email, no seeker notification.

### Task 4.5 — `(sweep)` email copy + trigger test ordering

- `src/services/email/templates.ts` `STATUS_COPY`: add `SHORTLIST`, `HIRED`, `WITHDRAWN` entries (headline + body + cta, matching existing tone; `HIRED` cta → `DASHBOARD_URL`, `WITHDRAWN` → neutral "View Dashboard").
- `src/tests/email-triggers.test.ts`: the two tests currently run APPLIED→INTERVIEWING then INTERVIEWING→REVIEWING — both violate the M4 matrix. Rework to:
  - Test 1 ("routes a transition to INTERVIEWING…"): `updateStatus(applicationId, 'SCREENING', ...)` (APPLIED→SCREENING legal), then set `interviewData`, then `updateStatus(applicationId, 'INTERVIEWING', ...)` (SCREENING→INTERVIEWING legal). `beforeEach` clears mocks, so assert on the final hop only: `sendInterviewInviteEmail` toHaveBeenCalledTimes(1) with `expect.objectContaining({ interviewType: 'video' })`. Do NOT assert `sendApplicationStatusEmail` not called — the SCREENING hop legitimately sent one.
  - Test 2 ("routes other transitions…"): from the INTERVIEWING state left by test 1, `updateStatus(applicationId, 'REJECTED', ...)` (legal); expect `sendApplicationStatusEmail` toHaveBeenCalledTimes(1) with `'REJECTED'` and `sendInterviewInviteEmail` not called.

Run full applications suite + notifications + email suites → green. Commit: `feat: applications pipeline statuses, scoring, timeline, withdraw, and realtime events`.

---

## M5 — Frontend types, API client, status sweep

**Files:** `src/types/application.ts`, `src/api/applications.ts`, new `src/utils/status.ts`, consumers `src/components/admin/AdminPage.tsx`, `src/components/dashboard/ApplicationCard.tsx`, `src/components/dashboard/HiringFlowModal.tsx`, `src/components/dashboard/ApplicationsTab.tsx` (if it has a config), `src/components/employer-dashboard/ApplicantsTab.tsx`, `src/components/candidate/CandidateDetailDrawer.tsx`, plus their tests.

### Task 5.1 — `src/types/application.ts` (red: compile against new tests)

```ts
export type ApplicationStatus =
  | 'applied' | 'screening' | 'shortlist' | 'interviewing'
  | 'offer' | 'hired' | 'rejected' | 'withdrawn'

export interface ScreeningAnswer {
  questionId: string
  answerText: string
  score?: number
  matchedKeywords?: string[]
  question?: { prompt: string; expectedKeywords: string[]; maxScore: number }
}

export interface ScreeningResult { score: number; maxPossible: number }

export interface TimelineEntry {
  id: string
  fromStatus: ApplicationStatus | null
  toStatus: ApplicationStatus
  actorRole: string
  createdAt: string
}
```

Extend the existing `Application` interface with `screeningResult?: ScreeningResult`, `screeningAnswers?: ScreeningAnswer[]`, `timeline?: TimelineEntry[]` (read the file first; do not remove existing fields).

### Task 5.2 — `src/api/applications.ts`

- `STATUS_TO_UPPER`: remove `reviewing`, add `screening: 'SCREENING'`, `shortlist: 'SHORTLIST'`, `hired: 'HIRED'`, `withdrawn: 'WITHDRAWN'`.
- `normalizeApplication`: map `screeningResult`, `screeningAnswers`, `timeline` (dates → strings as the rest of the object does).
- New functions (read the file and mirror existing signatures/error handling):
  - `getApplication(id: string): Promise<Application>`
  - `withdrawApplication(id: string): Promise<Application>`
  - extend the apply call to accept `screeningAnswers: { questionId: string; answerText: string }[]`.

### Task 5.3 — new `src/utils/status.ts`

Centralize the duplicated `statusConfig` records:

```ts
import type { ApplicationStatus } from '../types/application'

export const STATUS_CONFIG: Record<ApplicationStatus, { label: string; color: string }> = {
  applied: { label: 'Applied', color: 'bg-ink-muted/10 text-ink-muted' },
  screening: { label: 'Screening', color: 'bg-amber-500/10 text-amber-600' },
  shortlist: { label: 'Shortlist', color: 'bg-sky-500/10 text-sky-600' },
  interviewing: { label: 'Interviewing', color: 'bg-violet-500/10 text-violet-600' },
  offer: { label: 'Offer', color: 'bg-emerald-500/10 text-emerald-600' },
  hired: { label: 'Hired', color: 'bg-green-600/10 text-green-700' },
  rejected: { label: 'Rejected', color: 'bg-error/10 text-error' },
  withdrawn: { label: 'Withdrawn', color: 'bg-ink-muted/10 text-ink-muted' },
}

export const ALLOWED_TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  applied: ['screening', 'shortlist', 'rejected', 'withdrawn'],
  screening: ['shortlist', 'interviewing', 'rejected', 'withdrawn', 'applied'],
  shortlist: ['interviewing', 'offer', 'rejected', 'withdrawn'],
  interviewing: ['offer', 'rejected', 'withdrawn'],
  offer: ['hired', 'rejected', 'withdrawn'],
  hired: [],
  rejected: [],
  withdrawn: [],
}

export function canTransition(from: ApplicationStatus, to: ApplicationStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false
}
```

Update the four components to import `STATUS_CONFIG` instead of their local records (delete the locals). Specific line-level changes:
- `ApplicantsTab.tsx`: `statusConfig` → `STATUS_CONFIG`; replace `app.status !== 'reviewing'` with `app.status !== 'screening'` and `handleStatusChange(app.id, 'reviewing')` → `'screening'`.
- `CandidateDetailDrawer.tsx` (~lines 224/228): same `reviewing` → `screening` replacement.
- `ApplicationCard.tsx`: local record → import.
- `AdminPage.tsx`: local record → import.
- `HiringFlowModal.tsx`: `STAGES` — replace `{ key: 'reviewing', ... }` with `{ key: 'screening', label: 'Screening', description: 'Your application is being screened against the job requirements.' }`; add `{ key: 'hired', label: 'Hired', ... }`; extend `STATUS_ORDER`: `screening: 1`, `shortlist: 2`, `interviewing: 3`, `offer: 4`, `hired: 5`, `rejected: 3`, `withdrawn: 0`.

### Task 5.4 — `(sweep)` tests (red → green)

- `src/api/__tests__/applications.test.ts`: `'REVIEWING'` → `'SCREENING'` and `status: 'reviewing'` → `'screening'`.
- `src/components/dashboard/__tests__/ApplicationCard.test.tsx`: `status: 'reviewing'` → `'screening'`.
- `src/components/dashboard/__tests__/HiringFlowModal.test.tsx`: `status: 'reviewing'` → `'screening'`; assert the modal renders a "Screening" stage.
- New `src/utils/__tests__/status.test.ts`: `canTransition('screening', 'interviewing') === true`, `canTransition('applied', 'offer') === false`, `STATUS_CONFIG` has all 8 keys.

Run `npm run test:run`, `npm run lint`, `npm run build` → green. Commit: `feat(frontend): expand application status types and centralize status config`.

---

## M6 — PostJobForm screening question editor

**File:** `src/components/post-job/PostJobForm.tsx` (+ existing `__tests__/PostJobForm.test.tsx` must stay green). Read the form first to learn its state shape and submit path (props vs internal API call).

### Task 6.1 — editor UI

- Local draft type: `{ id: string; prompt: string; expectedKeywords: string; maxScore: number }`.
- Section (collapsed by default, visible under the description/requirements fields): heading "Screening questions (optional)", an "Add question" button, and one row per draft: prompt input, expected-keywords input (comma-separated, placeholder "e.g. python, fastapi"), maxScore number input (default 5, min 1, max 100), remove button.
- On submit, if drafts exist, append `screeningQuestions` to the payload: `drafts.map((d, i) => ({ prompt: d.prompt, expectedKeywords: d.expectedKeywords.split(',').map((s) => s.trim()).filter(Boolean), maxScore: Number(d.maxScore) || 5, order: i + 1 }))`.
- Keep all existing fields/validation/tests intact.

### Task 6.2 — tests `src/components/post-job/__tests__/PostJobFormScreening.test.tsx`

Adapt to the actual props (read the existing test file first):

```tsx
it('adds a screening question row and submits it in the payload', async () => {
  const onSubmit = vi.fn()
  render(<PostJobForm onSubmit={onSubmit} />)
  await userEvent.click(screen.getByRole('button', { name: /add screening question/i }))
  await userEvent.type(screen.getByLabelText(/question prompt/i), 'Years of Python?')
  await userEvent.type(screen.getByLabelText(/expected keywords/i), 'python, fastapi')
  await userEvent.click(screen.getByRole('button', { name: /submit job listing/i }))
  expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
    screeningQuestions: [expect.objectContaining({ prompt: 'Years of Python?', expectedKeywords: ['python', 'fastapi'], maxScore: 5 })],
  }))
})

it('removes a screening question row before submitting', async () => {
  // add two rows, remove one, submit, expect one question in the payload
})
```

Run frontend gates → green. Commit: `feat: screening question editor in job posting form`.

---

## M7 — ApplyJobForm dynamic screening answers

**File:** `src/components/apply/ApplyJobForm.tsx` (+ existing tests). Read it first to learn how the job is provided (`job` prop with `screeningQuestions`? or fetched).

### Task 7.1 — dynamic questions

- If the job has `screeningQuestions.length > 0`, render one labeled Textarea per question under the cover letter (`aria-label`/label = question prompt, `required`).
- State: `answers: Record<string, string>`; validate each answered before submit.
- On submit, include `screeningAnswers: questions.map((q) => ({ questionId: q.id, answerText: answers[q.id] ?? '' }))` in the apply payload.
- `src/data/jobs.ts` `Job` interface: add `screeningQuestions?: { id: string; prompt: string; expectedKeywords: string[]; maxScore: number; order: number }[]` so `mockJobs` and seeded jobs type-check. (If `Job` is a closed union from the API types, reconcile with 5.1.)

### Task 7.2 — tests `src/components/apply/__tests__/ApplyJobFormScreening.test.tsx`

```tsx
it('renders one answer field per screening question and submits answers', async () => {
  const onSubmit = vi.fn()
  const job = { ...mockJob, screeningQuestions: [
    { id: 'q1', prompt: 'Years of Python?', expectedKeywords: ['python'], maxScore: 10, order: 1 },
  ] }
  render(<ApplyJobForm job={job} onSuccess={onSubmit} onClose={vi.fn()} />)
  await userEvent.type(screen.getByLabelText('Years of Python?'), 'Five years')
  await userEvent.click(screen.getByRole('button', { name: /submit application/i }))
  expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
    screeningAnswers: [{ questionId: 'q1', answerText: 'Five years' }],
  }))
})
```

Run frontend gates → green. Commit: `feat: collect screening answers on application form`.

---

## M8 — PipelineTab Kanban

**New file:** `src/components/employer-dashboard/PipelineTab.tsx` + `src/utils/kanban.ts`. Requires `@dnd-kit/core` (+ `@dnd-kit/utilities`); confirm they are in `package.json` (or install `@dnd-kit/core` before starting).

### Task 8.1 — pure `src/utils/kanban.ts` (red first)

```ts
export const PIPELINE_COLUMNS = [
  { key: 'applied', label: 'Applied', color: 'bg-ink-muted/10 text-ink-muted' },
  { key: 'screening', label: 'Screening', color: 'bg-amber-500/10 text-amber-600' },
  { key: 'shortlist', label: 'Shortlist', color: 'bg-sky-500/10 text-sky-600' },
  { key: 'interviewing', label: 'Interviewing', color: 'bg-violet-500/10 text-violet-600' },
  { key: 'offer', label: 'Offer', color: 'bg-emerald-500/10 text-emerald-600' },
  { key: 'hired', label: 'Hired', color: 'bg-green-600/10 text-green-700' },
] as const

export const TERMINAL_STATUSES = ['rejected', 'withdrawn'] as const

export function groupByStatus(apps: Application[]): Record<string, Application[]> { /* group, active columns only */ }
export function moveCard(columns: Record<string, Application[]>, fromKey: string, toKey: string, appId: string): { columns: Record<string, Application[]>; app: Application | null; allowed: boolean }
```

`moveCard` uses `canTransition` (from `utils/status.ts`); if the move is illegal it returns `{ columns, app: null, allowed: false }` — the UI never calls the API for illegal moves.

Tests `src/utils/__tests__/kanban.test.ts`: grouping puts apps in the right column, terminal apps excluded from columns; `moveCard` moves a card between legal columns and returns `allowed: false` for illegal (e.g. `applied → offer`).

### Task 8.2 — PipelineTab UI

- Props: `{ applications: Application[] }`. Uses `updateApplicationStatus` from `ApplicationsContext`.
- State: `columns = groupByStatus(applications)` (recomputed via effect when the prop changes).
- `DndContext onDragEnd`: `if (!event.over) return; const from = String(event.active.id).split(':')[0]; const to = String(event.over.id).split(':')[0]; const appId = String(event.active.id).split(':')[1];` → `moveCard(...)`; if `allowed`, optimistic set + `updateApplicationStatus(appId, to.toUpperCase() as any)`; on API failure, refetch and toast.
- Card id convention: `col-${status}:${appId}` (draggable ids) and `col-${status}` (droppable ids).
- Reuse `ApplicationCard` inside each draggable card (pass its existing props; read `ApplicationCard.tsx`).
- Bottom "Closed" section: grid of `rejected` + `withdrawn` cards, non-draggable.
- Toolbar: status counts per column; an "Add new" hint is out of scope.

### Task 8.3 — tests `src/components/employer-dashboard/__tests__/PipelineTab.test.tsx`

Mock `@dnd-kit/core` so jsdom can drive it deterministically:

```ts
vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children, onDragEnd }: any) => {
    ;(DndContext as any).__dragEnd = onDragEnd
    return children
  },
  useDraggable: () => ({ attributes: {}, listeners: {}, setNodeRef: () => {}, transform: null, isDragging: false }),
  useDroppable: () => ({ setNodeRef: () => {}, isOver: false }),
  DragOverlay: ({ children }: any) => children ?? null,
}))

function drag(appId: string, from: string, to: string) {
  ;(DndContext as any).__dragEnd({ active: { id: `col-${from}:${appId}` }, over: { id: `col-${to}` } })
}
```

Assert:
- renders 6 column headers and places a card in its column.
- `drag(app.id, 'applied', 'screening')` calls `updateApplicationStatus` with `'SCREENING'`.
- `drag(app.id, 'applied', 'offer')` does NOT call `updateApplicationStatus` (matrix gate).
- rejected/withdrawn cards appear in the Closed section, not in columns.

Wire into `EmployerDashboardPage.tsx` as a `PipelineTab` beside `ApplicantsTab` (read the tab rendering first; keep the existing tabs' tests green). Run frontend gates → green. Commit: `feat: employer kanban pipeline tab`.

---

## M9 — CandidateDetailDrawer enrichment

**File:** `src/components/candidate/CandidateDetailDrawer.tsx`. Read it first; it already renders application details and status buttons.

### Task 9.1 — screening + timeline sections

- If `application.screeningResult`: render a "Screening" section — score bar `score / maxPossible`, and each `screeningAnswers` row with question prompt, answer text, per-answer score.
- If `application.timeline?.length`: render a "Timeline" section — chronological steps `fromStatus → toStatus` with actor + relative/absolute date (reuse existing date formatting used in the drawer).
- Update the status buttons to use `STATUS_CONFIG` labels and to hide buttons when `canTransition(application.status, candidate)` is false.

### Task 9.2 — tests `src/components/candidate/__tests__/CandidateDetailDrawerScreening.test.tsx`

Render the drawer with an application that has `screeningResult`, one `screeningAnswer`, and 2 timeline entries; assert the prompt, answer text, score text, and both timeline labels appear. Run frontend gates → green. Commit: `feat: show screening scores and status timeline in candidate drawer`.

---

## M10 — Realtime pipeline stream

**Files:** `src/context/NotificationsContext.tsx` (read first — it already owns the `EventSource` for `/notifications/stream` and forwards `notification` and `new-message` events), `src/hooks/usePipelineStream.ts` (new), `src/components/employer-dashboard/PipelineTab.tsx` (wire).

### Task 10.1 — subscription hook

- If `NotificationsContext` does not already expose a generic event-subscription API, add one (a `subscribe(eventName, handler)` / `unsubscribe` registry feeding the EventSource `onmessage`/listeners), mirroring the existing `notification`/`new-message` handling so we keep one SSE connection.
- New `usePipelineStream()`: returns a `streamVersion` number. Subscribes to `'application:updated'`; on each event, increment. Unsubscribe on unmount. No-op when role is not EMPLOYER.

### Task 10.2 — wire + test

- `PipelineTab`: `const streamVersion = usePipelineStream()`; `useEffect` on `streamVersion` (skip initial) → refetch employer applications from context (`refresh`/`setApplications` — read `ApplicationsContext` for the exact API).
- Test `src/hooks/__tests__/usePipelineStream.test.tsx`: render a test harness component inside a mocked `NotificationsContext` (or spy on `subscribe`), fire an `application:updated` event, assert `streamVersion` incremented and a refetch callback was invoked.

Run frontend gates → green. Commit: `feat: live-refresh kanban on application status events`.

---

## Final Verification

1. Backend: `npx vitest run` — full suite green.
2. Frontend: `npm run test:run`, `npm run lint`, `npm run build` — all green.
3. Manual smoke (optional): register employer → create job with questions → register seeker → apply with answers → move card across the kanban → confirm timeline + score render in drawer, and a second browser tab updates live.

## Risks / Notes

- **WIP overlap:** `jobs.service.ts` / `swagger.ts` carry an unrelated uncommitted "random sort" feature. Get the user's call before M1/M3.
- **Existing test churn:** `(sweep)` tasks deliberately change old expectations (403→200 where the RBAC bug was the cause; REVIEWING→SCREENING). Everything else in those files stays untouched.
- **dnd-kit in jsdom:** the M8 mock of `@dnd-kit/core` is the plan; if the real drag flow needs visual QA, that's manual.
- **SSE coverage:** backend SSE assertions rely on the notifications/SSE test patterns already in the repo; the seeker-side `notification` event already existed, M4/M10 only add the employer-side `application:updated` event.
- **Email status copy:** new statuses fall back to the generic template until 4.5 adds copy — tests only assert `sendApplicationStatusEmail` was called, not copy text, so ordering is safe.
