# Plan: HireHub Onboarding Wizard — Backend

Date: 2026-07-31
Spec: `docs/superpowers/specs/2026-07-31-hirehub-onboarding-wizard.md`
Repo: `hirehub-backend` (Express 4 + Prisma 5.22 + Postgres 16)
Execution: subagent-driven development (fresh implementer per task, review +
commit after each task).

## Ground rules

- Working tree is dirty (modified `server.ts`, `jobs.controller.ts`, `seed.ts`,
  `migration.sql`, `migration_lock.toml`; untracked `docs/`, migrations/
  `add_rbac_and_audit`, `public/`, several `src/tests/*.test.ts`). **Never
  revert these.** `git checkout -b feat/onboarding-wizard` preserves them.
- Verification command: `npm test` (supertest against the real `hirehub` dev
  DB). Current baseline: **70/70 passing**.
- `prisma migrate status`: DB up to date with 4 migrations; `migrate dev` is
  safe. New tests go in `src/tests/onboarding.test.ts` (grown per task, red →
  green per task).
- Follow existing conventions: response helpers in `src/lib/response.ts`
  (`success`, `created`, `noContent`), controllers `try/catch → next(error)`,
  `req.user!.userId`, inline zod validation on routes, `requireRole(...)`
  middleware.
- Commit message style: imperative, e.g. `feat: extend profile with onboarding fields`.

## Task 1 — Prisma schema + migration

Not unit-testable (config). Verify with `npx prisma migrate status` + full suite.

1. `prisma/schema.prisma` — extend `User`:

```prisma
headline            String?       @db.VarChar(120)
location            String?       @db.VarChar(100)
skills              String[]      @default([])
resumePath          String?       @db.VarChar(255)
resumeFileName      String?       @db.VarChar(255)
salaryMin           Int?
salaryMax           Int?
currency            String?       @db.VarChar(3)
remoteOnly          Boolean?      @default(false)
employmentType      String?       @db.VarChar(50)
```

Add `CompanyInvite`:

```prisma
enum CompanyInviteStatus {
  PENDING
}

model CompanyInvite {
  id        String                @id @default(cuid())
  companyId String
  email     String                @db.VarChar(255)
  status    CompanyInviteStatus   @default(PENDING)
  createdAt DateTime              @default(now())
  updatedAt DateTime              @updatedAt
  company   Company               @relation(fields: [companyId], references: [id], onDelete: Cascade)

  @@unique([companyId, email])
  @@map("company_invites")
}
```

Add relation to `Company`:

```prisma
invites CompanyInvite[]
```

2. `npx prisma migrate dev --name add_onboarding_fields`
3. Verify `npx prisma migrate status` shows up to date; `npm test` still 70/70.
4. Commit: `feat(db): add onboarding fields and company invites`.

## Task 2 — Extend PATCH /api/auth/profile + selects

TDD. First add to `src/tests/onboarding.test.ts`:

- `describe('PATCH /api/auth/profile onboarding fields')` — register user,
  PATCH `{ headline, location, skills: ['a','b','c'], remoteOnly: true,
  salaryMin: 60000, salaryMax: 90000, currency: 'USD',
  employmentType: 'Full-time' }` → 200, body reflects fields.
- PATCH `{ skills: [] }` → 400 (min 1).
- PATCH `{ skills: 16 items }` → 400 (max 15).
- PATCH `{ salaryMin: -1 }` → 400.
- PATCH `{ onboardingCompleted: true }` → 200 + `onboardingCompleted: true`.

Implement:
- `src/modules/auth/auth.routes.ts` — extend `updateProfileSchema`:
  `headline: z.string().max(120).optional()`,
  `location: z.string().max(100).optional()`,
  `skills: z.array(z.string().min(1).max(50)).min(1).max(15).optional()`,
  `salaryMin: z.number().int().nonnegative().optional()`,
  `salaryMax: z.number().int().nonnegative().optional()`,
  `currency: z.string().max(3).optional()`,
  `remoteOnly: z.boolean().optional()`,
  `employmentType: z.string().max(50).optional()`,
  `resumePath: z.string().max(255).optional()`,
  `resumeFileName: z.string().max(255).optional()`,
  `onboardingCompleted: z.boolean().optional()`.
- `src/modules/auth/auth.service.ts`:
  - `updateProfile(userId, data)` — only assign keys where `!== undefined`
    (spread pattern already used for name/email/phone/bio/companyName);
    `return prisma.user.update({ where: { id: userId }, data, select: USER_SELECT })`.
  - Extract/define a shared `USER_SELECT` including all new fields; use it in
    `register`, `getMe`, and `updateProfile`.
  - `register` select must include `onboardingCompleted` (gate needs it right
    after signup) and the new fields.
- `src/modules/auth/auth.controller.ts` — no change (passes validated body).

Verify: `npm test` — new onboarding describe green, existing 70 still green.
Commit: `feat(auth): accept onboarding fields on profile update`.

## Task 3 — Serve uploaded resumes

TDD. In `src/tests/onboarding.test.ts`:
- Upload a resume via existing `POST /api/upload/resume` (PDF buffer) → capture
  `resumePath`, then `GET resumePath` against the app → 200 + `content-type`
  `application/pdf`.
- (`POST /api/upload/resume` returns the stored path; assert it starts with
  `/uploads/resumes/`.)

Implement:
- `src/app/app.ts` — after the existing static mounts add:

```ts
app.use('/uploads/resumes', express.static(path.join(process.cwd(), 'uploads', 'resumes'), { maxAge: '7d', fallthrough: false }))
```

  (confirm `path` is already imported; the avatars/static mount will show the
  convention. Keep `fallthrough: false` off if it changes existing error shape —
  match the file currently serves.)

Verify: new resume GET test green; full suite green.
Commit: `feat: serve uploaded resumes statically`.

## Task 4 — Company logo upload

TDD. In `src/tests/onboarding.test.ts`:
- Register employer, create company (PUT `/api/company`), upload a small PNG
  buffer as `logo` field → 200 `{ logoUrl }` starting `/company-logos/`;
  `GET logoUrl` → 200.
- Upload as seeker → 403.
- Upload a text file as logo → 400.

Implement:
- `src/services/upload.ts` — add `uploadLogo` (multer: `uploads/logos`, 2 MB,
  jpeg/png/webp filter — mirror `uploadAvatar`).
- `src/app/app.ts` — static mount `/company-logos` → `uploads/logos`.
- `src/modules/company/company.routes.ts` — add `POST /company/logo`,
  `requireAuth`, `requireRole('EMPLOYER')`, `uploadLogo.single('logo')`.
- `src/modules/company/company.controller.ts` — handler: get employer's company
  (`getMyCompany`), `prisma.company.update` set `logo = req.file.filename` (or
  `/company-logos/<name>` — match whatever `avatarUrl` stores for avatars);
  respond with `success({ logoUrl })`. Errors via `next(error)`.
- `src/modules/company/company.service.ts` — add `uploadLogo(userId, filename)`
  if a service method fits the existing shape.

Verify: new logo tests green; full suite green.
Commit: `feat(company): upload company logo`.

## Task 5 — Company invites endpoints

TDD. In `src/tests/onboarding.test.ts`:
- Employer with company: `POST /api/company/invites` `{ emails: ['a@x.com',
  'B@x.com', 'c@x.com'] }` → 201, response invites length 3, emails lowercased.
- Repeat with `['a@x.com']` → 201, total unique rows still 3 (idempotent).
- `POST` with `['not-an-email']` → 400.
- `POST` with 21 emails → 400.
- `GET /api/company/invites` → 200, rows newest-first, includes the invites.
- Employer **without** a company → 404.
- Seeker → 403.

Implement:
- `src/modules/company/company.service.ts`:
  - `inviteTeam(userId, emails)` — company = `getMyCompany` (throw `AppError(404,
    'Company not found')`), dedupe lowercased emails, `createMany({ data,
    skipDuplicates: true })`, return `findMany` for company newest-first.
  - `getInvites(userId)` — `getMyCompany` then `findMany` orderBy createdAt desc.
- `src/modules/company/company.routes.ts` — `POST /company/invites` +
  `GET /company/invites`, zod `{ emails: array(min 1, max 20) of email }`.
- `src/modules/company/company.controller.ts` — handlers wrapping the service.

Verify: new invite tests green; full suite green.
Commit: `feat(company): persist team invites`.

## Task 6 — Final backend gate

- `npm test` full run → 70 existing + new all green.
- `npx prisma migrate status` → up to date.
- Commit any stragglers; leave `feat/onboarding-wizard` branch checked out.
