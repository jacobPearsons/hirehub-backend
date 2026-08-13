# HireHub: Demo Mode — Simulated Hiring Flow — Design

Date: 2026-08-13
Status: Draft (pending user review)
Repo: `hirehub-backend` (primary; no frontend code changes)

## Context

The marketplace half of HireHub works end-to-end (auth, jobs, search, apply, messaging, screening + ATS pipeline, website-chat interviews). But a fresh database — which is what `db:seed` produces — contains **zero applications, conversations, messages, or notifications**. Demoing the hiring flow means manually juggling three accounts, and the messaging/interview area looks empty. There is also no automated acceptance coverage for the whole journey (individual endpoints are unit/integration tested; the flow itself is not).

This spec covers a **Demo Mode** feature: a seeded, living, full-stage hiring scenario plus a real-time demo bot candidate, and an API-level end-to-end suite that drives the entire journey as the acceptance test for the flow.

## Goals

- `npm run db:seed:demo` produces a realistic, living scenario layered on top of `db:seed`: demo candidate users, dedicated jobs with screening questions, applications at **every** pipeline stage, a fully-exchanged website-chat interview thread, a couple of phone-interview threads, and notifications for both roles — idempotent to re-run.
- A **demo bot candidate** answers screening-question prompts and replies to employer messages in demo conversations in real time, with human-like delay, gated behind an env flag and invisible to real users.
- An **API-level end-to-end suite** (`src/tests/flow-e2e.test.ts`) drives the full journey through real endpoints as the acceptance test: create job → apply + score → status walk → website-chat interview → conversation seeded → two-way messages → offer/hire → permission guards.
- No new npm dependencies, no Prisma schema changes, no frontend code changes.

## Non-Goals

- Playwright / browser E2E (dropped — the frontend's 317 component tests already cover the UI surfaces; added value did not justify a new dep + browser downloads + flake surface).
- Demo bot with AI/LLM-generated content — replies are canned, deterministic, and tuned in one place.
- A dedicated "demo mode" banner or admin toggle in the product UI.
- Seeding on server boot (`DEMO_MODE` auto-seed) — seeding a DB silently at boot is rejected as surprising and hard to reason about.
- `NEW_MESSAGE` notification rows (the existing live SSE `new-message` push stays the only real-time mechanism; out of scope).

## Design Decisions

1. **Approach: dedicated demo module** (`src/modules/demo/`). A self-contained module keeps the base `seed.ts` untouched, mirrors the existing `seed-search-jobs.ts` pattern of a separate seed script, and keeps the bot in-process (reliable — no separate SSE-client process).
2. **Demo identity = reserved email convention.** Demo candidates use `demo.candidate<N>@hirehub.community`. Both the seed's idempotent cleanup and the bot's gating detect demo-ness by email (`^demo\.candidate\d+@hirehub\.community$`). No schema column, no migration.
3. **Bot hook is one narrow call** in `messages.service.ts` right after a message is created (`maybeScheduleDemoReply({ conversationId, senderId, recipientId })`). It no-ops unless: `DEMO_BOT_ENABLED=true`, the *recipient* is a demo candidate, and the *sender* is not a demo candidate (prevents bot-to-bot loops). The reply is scheduled with `setTimeout` (1.5–6s jitter) and calls the same `sendMessage`; errors are caught and logged, never thrown into the request cycle.
4. **Seed scenario is isolated and idempotent.** All scenario rows are keyed off the reserved demo emails (and the two seeded accounts alex/employer within the scenario). Re-running deletes scenario-scoped rows (messages → conversations → notifications → applications → demo users) then recreates them. The 3 demo jobs are dedicated (owned by `employer@hirehub.community`) with their own screening questions — the 32 base-seed jobs are untouched.
5. **Seed writes data directly via Prisma** (not through API endpoints) — scores use the real `ScreeningEngine`, and no SSE is fired (first UI load fetches state). Timestamps are staged across the past ~3 weeks so the pipeline looks organically built; the website-chat interview is the freshest activity.

## Data Model (Prisma)

**No Prisma schema changes.** No migration. The scenario uses existing models: `User`, `Job`, `ScreeningQuestion`, `Application`, `ApplicationTimelineEntry`, `ScreeningAnswer`, `ScreeningResult`, `Conversation`, `Message`, `Notification`.

Demo user emails (password `password123`, `onboardingCompleted=true`, role `SEEKER`, realistic profile fields + resume path):
- `demo.candidate1@hirehub.community` — the **bot candidate** (website-chat interview)
- `demo.candidate2@hirehub.community` … `demo.candidate5@hirehub.community` — stage coverage
- `alex@example.com` (existing seeker) — 2 applications + a message thread

Demo jobs (3, owned by `employer@hirehub.community`, each with 3–4 real `ScreeningQuestion`s): e.g. Senior Product Designer, Frontend Engineer, Data Analyst.

Applications (each with `ScreeningResult` + per-answer `ScreeningAnswer` scores via the real `ScreeningEngine`, `ApplicationTimelineEntry` rows with realistic actor/dates, resume + cover letter):

| Candidate | Job | Status | Notes |
|---|---|---|---|
| c1 (bot) | Product Designer | interviewing | website-chat interview, fully-exchanged thread |
| c2 | Product Designer | screening | drawer shows scored answers |
| c3 | Frontend Engineer | shortlist | |
| c4 | Frontend Engineer | offer | offer letter `accepted: true` |
| c5 | Data Analyst | hired | preboarding checklist populated |
| alex | Data Analyst | interviewing | phone interview scheduled |
| alex | Frontend Engineer | applied | |
| c3 (2nd) | Product Designer | rejected | older cycle |
| c5 (2nd) | Data Analyst | withdrawn | |

Messages & conversations:
- Website-chat thread (employer ↔ c1): welcome + `Q: {prompt}` screening-question messages → candidate answers → employer follow-up → candidate reply. Spread over ~48h.
- Phone-interview thread (employer ↔ alex): a couple of messages.

Notifications (`APPLICATION_STATUS`): ~3–4 for the employer, a couple for alex, a couple for demo candidates.

## Backend API Changes

No new routes. Changes:

- `src/config/env.ts` — add `demoBotEnabled` boolean (env `DEMO_BOT_ENABLED`, default off).
- `src/modules/messages/messages.service.ts` — one hook after message creation: `maybeScheduleDemoReply(...)`.
- `src/modules/demo/demo-bot.ts` — the responder + canned reply generator.
- `src/modules/demo/demo.types.ts` — reserved-email regex + demo constants.
- `src/modules/demo/demo.seed.ts` — the `db:seed:demo` script.
- `package.json` — `"db:seed:demo": "tsx src/modules/demo/demo.seed.ts"` (check existing seed scripts for the exact tsx invocation convention).

## Frontend Changes

None. (The existing UI already renders everything the scenario exercises: ApplicationsTab cards, CandidateDetailDrawer scores/timeline, InterviewScheduleModal/InterviewDetails, MessagesTab, PipelineTab kanban, NotificationBell.)

## Milestones (Tasks)

1. **Task 1 — Env flag + demo constants/types**: `DEMO_BOT_ENABLED` in `env.ts`; `demo.types.ts` (email regex, reply types, reply content constants placeholder).
2. **Task 2 — Seed script** `demo.seed.ts` + `package.json` script: users, demo jobs + screening questions, scored applications + timelines, interviews (website-chat thread + phone), notifications. Idempotent delete-then-create. Verify by running against a fresh `db:seed` and spot-checking the DB + one headless-browser load of both dashboards.
3. **Task 3 — Demo bot**: reply generator (ordered Q-answers, then generic rotation) + `maybeScheduleDemoReply` + messages.service hook + unit tests with fake timers (fires only for demo recipient + env on; no-op for non-demo / bot-to-bot / env off; generator returns pending-Q answer when applicable).
4. **Task 4 — E2E flow suite** `src/tests/flow-e2e.test.ts`: the 7-step full-journey acceptance test through real endpoints.
5. **Task 5 — Whole-branch review + gates**: full `npm test` + `npm run build`; capture review diff; record in `.superpowers/sdd/progress.md`.

## Testing

- **Unit**: `demo-bot.test.ts` with Vitest fake timers — trigger conditions (demo recipient / non-demo / bot-to-bot / env off), reply scheduling, canned-answer selection.
- **Integration**: `flow-e2e.test.ts` — the complete journey asserted step-by-step (see §Goals), using the existing register→supertest pattern from `interview-conversation.test.ts`. Illegal transitions and permission guards (candidate PATCH on employer's app, second employer 403) included.
- **Manual demo check**: `db:seed` + `db:seed:demo`, run the app, verify both dashboards, the messages deep-link, and the live bot reply (env on).

## Verification Commands

```
cd hirehub-backend
npm test                                  # full suite (218+ existing + new)
npm test -- flow-e2e demo-bot             # focused new suites
npm run build                             # tsc clean
npm run db:seed && npm run db:seed:demo   # build the demo scenario
# manual: start server with DEMO_BOT_ENABLED=true, load dashboards in browser
```

## Deliverables

- Spec committed: `docs/superpowers/specs/2026-08-13-demo-mode-design.md`
- Plan committed: `docs/superpowers/plans/2026-08-13-demo-mode.md`
- One commit per milestone task, review diff captured per the SDD convention, final whole-branch review, merged to `feat/demo-mode`.
