# HireHub E2E Testing & Flow Verification — Specification

> **Status:** Approved for implementation
> **Date:** 2026-07-20

---

## 1. Goal

Verify that all critical HireHub user flows work end-to-end — from registration through job application to employer review — by writing tests first (TDD), fixing broken features discovered during testing, and ensuring every flow produces the expected outcome at both the API and UI layers.

## 2. Scope

### In Scope
- Backend integration tests for all untested API modules (blog, contact, pricing, saved-jobs, admin, upload)
- Backend integration tests for missing auth flows (logout, refresh token, reset password)
- Backend integration tests for missing job flows (update, delete, ownership enforcement)
- Backend integration tests for missing application flows (employer list by jobId, unauthorized status update)
- Frontend component tests for all critical auth pages (SignupPage, ForgotPasswordPage, ResetPasswordPage)
- Frontend component tests for job flow pages (JobBoardPage, JobDetailPage)
- Frontend component tests for employer flow (EmployerDashboardPage, PostJobPage)
- Frontend component tests for seeker flow (DashboardPage)
- Frontend component tests for secondary flows (BlogPage, ContactPage)
- Frontend hook tests (useJobs, useJob, useSavedJobsQuery, useApplicationsQuery)
- Bug fixes discovered during testing (missing frontend API functions, broken flows)
- Missing `updateJob` and `deleteJob` functions in frontend API client

### Out of Scope
- Full browser-based E2E tests (Playwright/Cypress) — requires running services
- Load/performance testing
- Email delivery verification (Resend/EmailJS integration tests)
- Admin UI (no frontend pages exist)
- Hiring flow persistence (interview scheduling, offer letters — UI-only components with no backend)

## 3. Critical User Flows

### Flow 1: Authentication (Register → Login → Protected Access → Logout)
**Expected behavior:**
1. User registers with valid data → receives access token + refresh token, user created in DB
2. User logs in with correct credentials → receives new tokens
3. User accesses `/api/auth/me` with valid token → gets profile
4. User logs out → refresh token invalidated, cannot refresh session
5. Expired access token + valid refresh token → new access token issued
6. Password reset: request token → reset password → login with new password
7. Duplicate registration → 409 Conflict
8. Wrong password → 401 Unauthorized
9. Missing fields → 400 Validation Error

### Flow 2: Job Seeker (Browse → Search → View Detail → Apply → Track → Save)
**Expected behavior:**
1. Browse jobs → paginated list returned
2. Search jobs → full-text search results ranked by relevance
3. Filter by category/seniority → filtered results
4. View job detail → full job data with employer info
5. Apply to job → application created with status APPLIED
6. Cannot apply twice to same job (constraint)
7. Employer cannot apply (403)
8. Track applications → seeker sees own applications with job details
9. Save job → saved in DB, idempotent (upsert)
10. Unsave job → removed from saved list
11. List saved jobs → returns saved jobs with job data

### Flow 3: Employer (Register → Post → Manage → Review Applicants)
**Expected behavior:**
1. Register as EMPLOYER → role stored correctly
2. Post job → job created with employerId
3. Update own job → fields updated
4. Cannot update another employer's job → 403
5. Delete own job → removed from DB
6. Cannot delete another employer's job → 403
7. View applicants for own job → applications listed
8. Cannot view applicants for another employer's job → 403
9. Update application status → status changed, notification sent
10. Cannot update status for application on another employer's job → 403

### Flow 4: Blog (Browse → Read)
**Expected behavior:**
1. List blog posts → paginated, ordered by date
2. Filter by category → filtered results
3. Get post by slug → full post data
4. Non-existent slug → 404

### Flow 5: Contact (Submit)
**Expected behavior:**
1. Submit valid contact form → 201 Created
2. Missing required fields → 400 Validation Error
3. Invalid email format → 400 Validation Error

### Flow 6: Admin (Manage Users → Manage Jobs → Manage Blog)
**Expected behavior:**
1. Admin lists users → all users returned
2. Non-admin cannot access → 403
3. Admin updates user role → role changed
4. Admin lists all jobs → all jobs returned
5. Admin deletes any job → removed
6. Admin lists all blog posts → all posts returned
7. Admin deletes any blog post → removed

### Flow 7: Resume Upload
**Expected behavior:**
1. Seeker uploads PDF → file saved, path returned
2. Employer cannot upload → 403
3. Non-PDF file → rejected
4. No file → 400 Validation Error

## 4. Testing Strategy

### TDD Workflow (Red → Green → Refactor)
1. Write the failing test first
2. Run it to confirm it fails for the expected reason
3. Implement the minimum code to make it pass
4. Run it to confirm it passes
5. Refactor if needed, confirm tests still pass
6. Commit

### Backend Testing
- **Framework:** Vitest + Supertest
- **Database:** Real PostgreSQL (integration tests, not mocks)
- **Setup:** Unique emails per test run to avoid collisions
- **Cleanup:** afterAll deletes test data
- **Pattern:** Follows existing `auth.test.ts` / `jobs.test.ts` / `applications.test.ts` conventions

### Frontend Testing
- **Framework:** Vitest + @testing-library/react + user-event
- **Environment:** jsdom
- **Mocking:** Mock API modules (`vi.mock('../../../api/...`)`)
- **Pattern:** Follows existing `LoginPage.test.tsx` / `Button.test.tsx` conventions
- **Provider wrapping:** MemoryRouter + ToastProvider + AppProvider as needed

## 5. Bug Fixes to Implement During TDD

Discovered during codebase analysis — these must be fixed as part of writing tests:

### BUG-1: Missing frontend API functions for job management
- **File:** `hirehub-frontend/src/api/jobs.ts`
- **Missing:** `updateJob(id, data)` and `deleteJob(id)`
- **Impact:** Employers cannot edit or delete jobs from the UI
- **Fix:** Add `updateJob` (apiPatch) and `deleteJob` (apiDelete) functions

### BUG-2: Missing frontend API function for employer job listings
- **File:** `hirehub-frontend/src/api/jobs.ts`
- **Missing:** `listEmployerJobs()` — employer-specific endpoint to list own jobs
- **Impact:** Employer dashboard cannot show the employer's own job listings
- **Backend:** Need `GET /api/jobs/employer/me` endpoint or filter on existing list
- **Fix:** Add backend route + service method + frontend API function

### BUG-3: Missing frontend API function for employer applications
- **File:** `hirehub-frontend/src/api/applications.ts`
- **Missing:** `listEmployerApplications(jobId)` — already exists in backend but frontend only has `listApplications()` which is seeker-only
- **Impact:** Employer dashboard cannot show applicants for a specific job
- **Fix:** Add `listEmployerApplications(jobId)` function that passes jobId as query param

## 6. Acceptance Criteria

- [ ] All backend modules have integration tests covering happy path + error cases
- [ ] All critical frontend pages have component tests covering rendering + user interaction
- [ ] All tests pass (`bun run test` in both repos)
- [ ] All bug fixes from §5 are implemented and tested
- [ ] Each flow from §3 can be verified by running the corresponding test suite
- [ ] No regressions in existing tests
