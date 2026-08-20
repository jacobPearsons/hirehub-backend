# Interview Conversation Endpoint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `POST /api/applications/:id/interview-conversation` — an endpoint the frontend calls when scheduling a `website-chat` interview. It creates (or reuses) the existing Conversation between the job's employer and the candidate (keyed on the job), seeds an intro message containing the candidate's screening questions (so the interview is hosted on-site in HireHub chat), and returns the conversation. No DB schema changes.

**Architecture:** Backend already has a full messages module (`src/modules/messages/`). `MessagesService.createOrGetConversation(employerId, candidateId, jobId?)` (messages.service.ts:53) already finds-or-creates; `sendMessage` (messages.service.ts:36) already SSE-pushes `new-message` to the recipient via `sendToUser`. The `openSupportConversation` method (messages.service.ts:65-78) is the exact template: create/get conversation, seed first message if the thread is empty, return the conversation. Applications are loaded with candidate + job context; the employer identity and `application:update` permission come from `req.user` / `evaluatePermission` (pattern already used in `PATCH /applications/:id/status`).

**Participant (confirmed):** Frontend `InterviewScheduleModal.tsx` submits this endpoint after calling `updateApplicationInterview`.

**Tech Stack:** Express, Prisma, existing `zod` `validate()` middleware, existing `requireAuth` + `requirePermission('application:update')` guards.

## Global Constraints

- Follow existing module structure: applications module owns the endpoint; it calls into `MessagesService` (no new module)
- Commits go on the `feat/interview-conversation` branch (one commit per task)
- Run backend `npm test`, `npm run build`
- No new npm packages
- Keep existing behavior backward compatible — `createOrGetConversation`/`sendMessage` stay as-is
- Do not reuse `openSupportConversation` (that targets the ADMIN user); write a dedicated application-scoped method

---

### Task 1: Service method `openInterviewConversation(applicationId, employerId)`

**Files:**
- Modify: `src/modules/applications/applications.service.ts`
- Test: `src/tests/applications-hiring-flow.test.ts` (extend) or new `src/tests/interview-conversation.test.ts`

**Interfaces:**
- Consumes: `createOrGetConversation(employerId, candidateId, jobId)` and `sendMessage(conversationId, senderId, content)` from `MessagesService` (already injected/imported in applications.service.ts — verify current import style first)
- Produces: `openInterviewConversation(applicationId, employerId)` → `{ conversation, candidate }`

- [ ] **Step 1: Read the current applications service + messages service**

Run: `cat src/modules/applications/applications.service.ts && cat src/modules/messages/messages.service.ts`

Confirm: how `MessagesService` is referenced in applications.service.ts (already imports `sendApplicationStatusEmail`, `sendToUser`, `notificationsService` — check for an existing `messagesService` import; add one if absent).

- [ ] **Step 2: Write the failing test**

Extend `src/tests/applications-hiring-flow.test.ts` (uses the register-users → create-job → create-application pattern) with:

```ts
describe('POST /api/applications/:id/interview-conversation', () => {
  it('creates a conversation with the employer and seeds the screening questions', async () => {
    const res = await request(app)
      .post(`/api/applications/${applicationId}/interview-conversation`)
      .set('Authorization', `Bearer ${employerToken}`)
      .expect(201)

    expect(res.body.data.conversation.jobId).toBe(jobId)
    const messages = await request(app)
      .get(`/api/conversations/${res.body.data.conversation.id}/messages`)
      .set('Authorization', `Bearer ${candidateToken}`)
      .expect(200)
    expect(messages.body.data[0].content).toContain('screening')
  })

  it('reuses an existing conversation instead of creating a duplicate', async () => {
    const first = await request(app).post(`/api/applications/${applicationId}/interview-conversation`).set('Authorization', `Bearer ${employerToken}`)
    const second = await request(app).post(`/api/applications/${applicationId}/interview-conversation`).set('Authorization', `Bearer ${employerToken}`)
    expect(first.body.data.conversation.id).toBe(second.body.data.conversation.id)
  })

  it('rejects a non-employer', async () => {
    await request(app).post(`/api/applications/${applicationId}/interview-conversation`).set('Authorization', `Bearer ${seekerToken}`).expect(403)
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- interview-conversation`
Expected: FAIL — route doesn't exist (404).

- [ ] **Step 4: Add the service method**

In `applications.service.ts`:

```ts
async openInterviewConversation(applicationId: string, employerId: string) {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    include: { candidate: { select: { id: true } }, job: { select: { id: true, employerId: true, title: true } } },
  })
  if (!application) throw new NotFoundError('Application')
  if (application.job.employerId !== employerId) throw new AuthorizationError()

  const conversation = await messagesService.createOrGetConversation(employerId, application.candidate.id, application.job.id)
  const existing = await prisma.message.count({ where: { conversationId: conversation.id } })
  if (existing === 0) {
    await messagesService.sendMessage(
      conversation.id,
      employerId,
      `Welcome to your HireHub interview for ${application.job.title}! Please reply to the questions below to get started.`,
    )
  }
  return { conversation }
}
```

(Follow the exact class/import conventions of the file — if the service is a class with injected deps, mirror `openSupportConversation`'s shape.)

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- interview-conversation`
Expected: PASS (all three cases).

### Task 2: Route + controller

**Files:**
- Modify: `src/modules/applications/applications.routes.ts`
- Modify: `src/modules/applications/applications.controller.ts`

- [ ] **Step 1: Add the route**

In `applications.routes.ts` (mirror the existing `PATCH /applications/:id/status` line, which already uses `requirePermission('application:update')`):

```ts
router.post(
  '/applications/:id/interview-conversation',
  requireAuth,
  requirePermission('application:update'),
  validate(z.object({ params: z.object({ id: z.string() }) })),
  applicationsController.openInterviewConversation,
)
```

- [ ] **Step 2: Add the controller**

In `applications.controller.ts`:

```ts
async openInterviewConversation(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await applicationsService.openInterviewConversation(req.params.id, req.user!.userId)
    res.status(201).json({ success: true, data })
  } catch (err) { next(err) }
}
```

- [ ] **Step 3: Run the full backend test suite + build**

Run: `npm test && npm run build`
Expected: all PASS, build clean. Confirm no other test regressed (existing `messages.test.ts` and `applications-*.test.ts` must stay green).

### Task 3: Seed each screening question as its own message

**Decision (confirmed):** each screening question becomes one message in the interview thread, so the candidate replies per-question inside HireHub chat. The questions come from the job's `ScreeningQuestion` rows (`prompt`, `order`), not from the application's answers.

**Schema (confirmed):** `ScreeningQuestion { id, jobId, prompt, expectedKeywords, maxScore, order }`, `ScreeningAnswer { id, applicationId, questionId, answerText, score, matchedKeywords }` (prisma/schema.prisma L179-203).

- [ ] **Step 1: Extend the seeded messages**

In the `openInterviewConversation` method (Task 1): when the thread is empty, after the welcome message, load the job's questions ordered by `order` and `sendMessage` one per question:

```ts
const questions = await prisma.screeningQuestion.findMany({
  where: { jobId: application.job.id },
  orderBy: { order: 'asc' },
})
for (const q of questions) {
  await messagesService.sendMessage(conversation.id, employerId, `Q: ${q.prompt}`)
}
```

- [ ] **Step 2: Extend the test**

Assert the thread contains the welcome message plus one message per screening question:

```ts
const contents = messages.body.data.map((m: { content: string }) => m.content)
expect(contents).toContain('Q: ...first screening prompt...')
```

(Add the screening question in the test's job-creation fixture — check how `jobs-screening.test.ts` attaches `screeningQuestions` to a job.)

- [ ] **Step 3: Re-run the backend suite**

Run: `npm test && npm run build`
Expected: all PASS, including the reuse test (only seeds when thread empty) and non-employer 403.
