# HireHub: Screening Questions + ATS Pipeline Kanban — Design

Date: 2026-08-11
Status: Approved (user approved design 2026-08-11)
Repo: `hirehub-backend` + `hirehub-frontend`

## Context

musthave.md defines a full hiring lifecycle (§42). Today the marketplace half works (auth, jobs, search, apply, messaging), but the ATS half is mostly absent: employers get a flat applicant list, applications stop at `OFFER`, there is no screening, no pipeline stages, no hiring timeline, and a RBAC bug 403s fresh employers on `application:update` because no `RoleBinding` is created at signup.

This spec covers the **Screening + ATS Kanban** sub-project: screening questions on jobs, candidate answers at apply time, deterministic scoring, and a drag-and-drop pipeline board.

## Goals

- Employers define screening questions per job (create + edit); public job detail returns them.
- Apply form renders dynamic question fields; required questions enforced client- and server-side.
- `ScreeningEngine` is a pure, deterministic, unit-tested function.
- Employers get a Kanban board grouped by pipeline stage; dragging a card changes status respecting a transition matrix.
- Status enum expands; every status change writes a timeline entry, sends the right email/notification, and emits an SSE `application:updated` event to the job owner.
- A fresh `EMPLOYER` can move candidates without admin intervention (RBAC auto-binding fix).

## Non-Goals

- Assessments / auto-evaluated tests (§9) — later sub-project.
- Interview feedback / scorecards (§10, §11) — sub-project 3.
- Offer system end-to-end (§12–15) — sub-project 4 (in-house Offer + e-sign agreed).
- Candidate notes, rejection templates, talent pool (§16, §22) — sub-project 5.
- Job *edit* page UI (backend `PATCH /jobs/:id` already supports it; UI deferred).

## Design Decisions

1. **`REVIEWING` → `SCREENING`.** New enum: `APPLIED, SCREENING, SHORTLIST, INTERVIEWING, OFFER, HIRED, REJECTED, WITHDRAWN`. Migration adds the new values, migrates `REVIEWING` rows to `SCREENING`, drops `REVIEWING` (custom SQL).
2. **Board is additive.** New `PipelineTab` (Kanban) alongside the existing `ApplicantsTab` list; employer toggles. Nothing is replaced.
3. **Rejected/Withdrawn are terminal** and shown in a collapsed "Closed" section, not as drag targets.
4. **Realtime** reuses the existing `/notifications/stream` SSE connection (no new endpoint); frontend listens for `application:updated` and refetches the board. Clean fallback: manual refresh.
5. **Screening scoring** is keyword-overlap only (job requirements + tags vs cover letter + answers) — transparent, testable, no ML.

## Data Model (Prisma)

```prisma
enum ScreeningQuestionType { TEXT PARAGRAPH MULTIPLE_CHOICE }
enum ApplicationStatus { APPLIED SCREENING SHORTLIST INTERVIEWING OFFER HIRED REJECTED WITHDRAWN }

model ScreeningQuestion {
  id        String  @id @default(cuid())
  jobId     String
  job       Job     @relation(fields: [jobId], references: [id], onDelete: Cascade)
  question  String
  type      ScreeningQuestionType @default(TEXT)
  options   String[]               // MULTIPLE_CHOICE only
  required  Boolean @default(true)
  order     Int     @default(0)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([jobId])
}

model ScreeningAnswer {
  id            String @id @default(cuid())
  applicationId String
  application   Application @relation(fields: [applicationId], references: [id], onDelete: Cascade)
  questionId    String
  question      ScreeningQuestion @relation(fields: [questionId], references: [id], onDelete: Cascade)
  answer        String
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@unique([applicationId, questionId])
  @@index([applicationId])
}

model ScreeningResult {
  id              String @id @default(cuid())
  applicationId   String @unique
  application     Application @relation(fields: [applicationId], references: [id], onDelete: Cascade)
  score           Int    // 0–100
  total           Int    // |keyword set|
  matchedKeywords String[]
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

model ApplicationTimelineEntry {
  id            String @id @default(cuid())
  applicationId String
  application   Application @relation(fields: [applicationId], references: [id], onDelete: Cascade)
  event         String // APPLIED | STATUS_CHANGED | WITHDRAWN | SCREENING_COMPLETED
  fromStatus    ApplicationStatus?
  toStatus      ApplicationStatus?
  note          String?
  actorId       String
  actor         User   @relation(fields: [actorId], references: [id])
  createdAt     DateTime @default(now())

  @@index([applicationId])
}
```

## ScreeningEngine (pure, deterministic)

```
scoreApplication(job, coverLetter, answers, hasResume) -> { score, total, matchedKeywords }
```

- **Keywords** `K` = normalized tokens of `job.requirements ∪ job.tags`. Normalize: lowercase, strip non-alphanumeric, drop tokens < 3 chars and stopwords.
- **Corpus** `C` = normalized tokens of coverLetter + all answer text.
- `matchedKeywords` = `K ∩ C`; `total = max(|K|, 1)`; `score = round(100 × |matched| / total)`.
- Empty `K` → `{ score: 0, total: 0, matchedKeywords: [] }`.
- Pure module `src/modules/screening/screeningEngine.ts`; unit tests pin exact scores (stopwords, casing, empty keyword set). `hasResume` is accepted but unused in v1 (kept for a future completeness bonus).

## Transition Matrix (enforced in service, 400 on violation)

| From | Allowed to |
|---|---|
| APPLIED | SCREENING, SHORTLIST, REJECTED, WITHDRAWN |
| SCREENING | SHORTLIST, INTERVIEWING, REJECTED, WITHDRAWN, APPLIED |
| SHORTLIST | INTERVIEWING, OFFER, REJECTED, WITHDRAWN |
| INTERVIEWING | OFFER, REJECTED, WITHDRAWN |
| OFFER | HIRED, REJECTED, WITHDRAWN |
| HIRED / REJECTED / WITHDRAWN | terminal (no transitions) |

Candidate **withdraw** (own application): only from APPLIED/SCREENING/SHORTLIST/INTERVIEWING → `WITHDRAWN`.

## Backend API Changes

**Jobs** (`src/modules/jobs/`)
- `createJobSchema` / `updateJobSchema` add `screeningQuestions?: { question, type, options?, required?, order? }[]`; zod enum validates `type`; `options` required for `MULTIPLE_CHOICE`.
- Service upserts/deletes `ScreeningQuestion` rows transactionally; update replaces the full set.
- `GET /jobs/:id` response includes `screeningQuestions` (ordered by `order`).

**Applications** (`src/modules/applications/`)
- `POST /applications`: accepts `screeningAnswers?: { questionId, answer }[]`. Validates required questions answered (400 otherwise) and MC answers ∈ options; creates Application + ScreeningAnswers + ScreeningResult in one transaction.
- `GET /applications/employer/me`: each item enriched with `screeningAnswers`, `screeningResult`, `timeline[]` (board data source).
- `PATCH /applications/:id/status`: enforce matrix + ownership/RBAC (existing `requirePermission('application:update')`); write timeline entry; send email + candidate notification; `sendToUser(job.employerId, 'application:updated', {...})`.
- `PATCH /applications/:id/withdraw` (new, `requireAuth`): candidate withdraws own application per matrix rule.
- Emails: `STATUS_COPY` gains SCREENING/SHORTLIST/HIRED/WITHDRAWN copy (existing `sendApplicationStatusEmail` reused; INTERVIEWING keeps its invite email).

## RBAC Foundation Fix

In `auth.service.ts register()` transaction: create a `RoleBinding` to the matching default role (EMPLOYER→employer, SEEKER→seeker). This unblocks `application:update`. Update tests that assert `permissions: []` / employer 403.

## Frontend Changes

- **Dep:** `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`.
- **Types:** `ApplicationStatus` union → `'applied'|'screening'|'shortlist'|'interviewing'|'offer'|'hired'|'rejected'|'withdrawn'`; extend `STATUS_TO_UPPER`, status pill maps (`ApplicantsTab`, `ApplicationCard`), `Job.screeningQuestions`, `Application.screeningAnswers/screeningResult/timeline`.
- **`PostJobForm`:** dynamic "Screening questions" editor (question text, type select, options editor for MC, required toggle); zod schema extended.
- **`ApplyJobForm`:** renders question fields from `job.screeningQuestions`; dynamic zod validation; submits answers.
- **New `PipelineTab`** (`employer-dashboard`): columns Applied/Screening/Shortlist/Interviewing/Offer/Hired + collapsed Closed (Rejected/Withdrawn); draggable cards (name, job, score chip, submitted date); drop → `updateApplicationStatus` with optimistic update + rollback on error/invalid move (toast). Score chip: ≥70 green, 40–69 amber, <40 red.
- **`CandidateDetailDrawer`:** adds screening answers + score breakdown + timeline.
- **`usePipelineStream` hook:** `EventSource('/notifications/stream?token=…')`, listen `application:updated` → refetch board.

## Milestones (each a green TDD chunk, committed separately)

1. **M0** RBAC auto-binding fix + test updates
2. **M1** Prisma: enum expansion + 4 models + migration + generate
3. **M2** ScreeningEngine + unit tests
4. **M3** Jobs API screening questions + tests
5. **M4** Applications API (answers, scoring, matrix, withdraw, timeline, emails, SSE) + tests
6. **M5** Frontend types + API client
7. **M6** PostJobForm question editor
8. **M7** ApplyJobForm dynamic questions
9. **M8** PipelineTab Kanban + score chips + status maps
10. **M9** CandidateDetailDrawer enrichment
11. **M10** Realtime `usePipelineStream` (P1)

## Testing

- Backend: Vitest (`vitest run`). Unit: ScreeningEngine (exact pinned scores). Integration: jobs create/update with questions; applications create with/without answers (required-answer 400, MC validation); transition matrix (allowed/denied/terminal); withdraw rules; timeline entries; SSE event emitted to job owner; emails routed by status; RBAC auto-binding (register→permissions, PATCH status succeeds).
- Frontend: Vitest + Testing Library (`npm run test:run`). ApplyJobForm dynamic fields + validation; PostJobForm question editor; PipelineTab render + status pill maps exhaustive; optimistic move + rollback.

## Verification Commands

- Backend: `vitest run` in `hirehub-backend`.
- Frontend: `npm run test:run`, `npm run lint`, `npm run build` in `hirehub-frontend`.
