# HireHub Backend — Branded Transactional Emails

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebrand every HireHub transactional email (welcome, application status, interview invite, password reset) into one branded template with an embedded logo mark, and send a dedicated interview-invite email when an application moves to `INTERVIEWING` — all sent immediately at the triggering lifecycle moment.

**Architecture:** A small email module replaces `src/services/email.ts`. `template.ts` owns a pure `renderLayout()` (logo header via `cid:logo-mark`, body card, footer) plus `escapeHtml`. `templates.ts` owns pure per-email content builders that return `{ subject, html }`. `index.ts` owns the Resend client and thin senders that attach the logo PNG as an inline image. Wiring is unchanged at the call sites: `auth.service.ts` (welcome, password reset) is untouched; `applications.service.ts` `updateStatus` routes `INTERVIEWING` to the interview invite and every other status to the shared status email.

**Tech Stack:** Node 22 + TypeScript (`tsx`, `tsc`), Express, `@resend/resend` v6, vitest, Prisma. Logo rasterized once with ImageMagick (`magick`) from `hirehub-frontend/public/logo-mark.svg`.

## Global Constraints

- Repo: `hirehub-backend`, branch `feat/onboarding-wizard`. Commit directly; never create/switch branches, never worktree.
- **Never run `git add -A` / `git add .`** — stage only the exact files each task names.
- Verify from `hirehub-backend/`: `npm test` (vitest run), `npx tsc --noEmit`.
- Tests run against the `hirehub` DB (`.env.test`; `src/tests/setup.ts` connects in global `beforeAll`). Email template/delivery tests are pure and must not touch the DB. Tests that create rows must delete them in `afterAll`.
- `.env.test` sets `RESEND_API_KEY=""` and `APP_URL="http://localhost:5173"`. With an empty/absent key the `resend` client is `null` and senders log-and-skip (no network).
- Sender constant: `HireHub <onboarding@resend.dev>`.
- Logo: `src/services/email/logo-mark.png` (96×104 RGBA, transparent background), read as a `Buffer` and attached inline via `{ filename: 'logo-mark.png', content, content_id: 'logo-mark' }`; referenced in HTML as `src="cid:logo-mark"`. The `build` script must copy it into `dist` so `npm start` works.
- Never commit the working `RESEND_API_KEY` from `.env`.
- Brand colors: page background `#f4f4f5`, card `#ffffff`, body text `#374151`, muted `#9ca3af`, footer label `#6b7280`, CTA background `#2563eb`, CTA text `#ffffff`, wordmark `#111827`. Font stack `Arial, Helvetica, sans-serif`.
- Every user-provided value inserted into HTML goes through `escapeHtml`. Meeting links render as anchors only when they start with `http://` or `https://`.
- Wire statuses are UPPERCASE (`APPLIED`, `REVIEWING`, `INTERVIEWING`, `REJECTED`, `OFFER`). `INTERVIEWING` is handled by `sendInterviewInviteEmail`, never the generic status email.
- `auth.service.ts` is NOT modified by this plan — it already imports `{ sendPasswordResetEmail, sendWelcomeEmail } from '../../services/email'`, and those named exports are preserved by the new `src/services/email/index.ts`. The signatures `sendWelcomeEmail(name, email)` and `sendPasswordResetEmail(email, resetUrl)` are unchanged.
- `src/services/email.ts` is DELETED in Task 3 (do not edit it before then). Until deletion, `../../services/email` resolves to that file; after deletion it resolves to `src/services/email/index.ts`. Tasks 1–2 import templates via explicit paths (`../services/email/template`, `../services/email/templates`) so they are unaffected.
- `applications.service.ts` and `auth.service.ts` contain pre-existing uncommitted work; only touch the exact lines each task names.

## File Map

- Create: `src/services/email/template.ts` — `Cta`, `escapeHtml`, `renderLayout`
- Create: `src/services/email/templates.ts` — `EmailContent`, `InterviewDetailsData`, `renderWelcome`, `renderStatusEmail`, `renderInterviewInvite`, `renderPasswordReset`
- Create: `src/services/email/logo-mark.png` — 96×104 RGBA PNG (binary)
- Create: `src/services/email/index.ts` — `SENDER`, `LOGO_CID`, `SendEmailPayload`, `EmailDeliverer`, `deliver`, `sendWelcomeEmail`, `sendApplicationStatusEmail`, `sendInterviewInviteEmail`, `sendPasswordResetEmail`
- Create: `src/tests/email-templates.test.ts`
- Create: `src/tests/email-delivery.test.ts`
- Create: `src/tests/email-triggers.test.ts`
- Delete: `src/services/email.ts`
- Modify: `src/modules/applications/applications.service.ts:5` (import) and `:51-56` (email dispatch)
- Modify: `package.json:8` (`build` script gains a copy step for the logo PNG)

---

### Task 1: Branded layout (`template.ts`)

**Files:**
- Create: `src/services/email/template.ts`
- Test: `src/tests/email-templates.test.ts` (this task adds the `escapeHtml`/`renderLayout` describe blocks; Task 2 appends the content-builder blocks to the same file)

**Interfaces:**
- Produces: `escapeHtml(value: unknown): string`; `renderLayout(bodyHtml: string, cta: Cta | null, preheader?: string): string` where `Cta = { label: string; href: string }`.

- [ ] **Step 1: Write the failing test**

Create `src/tests/email-templates.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { escapeHtml, renderLayout } from '../services/email/template'

describe('escapeHtml', () => {
  it('escapes HTML metacharacters', () => {
    expect(escapeHtml('<script>"&\'')).toBe('&lt;script&gt;&quot;&amp;&#39;')
  })

  it('coerces null and undefined to empty string', () => {
    expect(escapeHtml(null)).toBe('')
    expect(escapeHtml(undefined)).toBe('')
  })
})

describe('renderLayout', () => {
  it('includes preheader, logo cid, wordmark, body, CTA, and footer', () => {
    const html = renderLayout('<p>Hello</p>', { label: 'Go', href: 'https://example.com' }, 'A preheader')
    expect(html).toContain('A preheader')
    expect(html).toContain('src="cid:logo-mark"')
    expect(html).toContain('>HireHub</span>')
    expect(html).toContain('<p>Hello</p>')
    expect(html).toContain('>Go</a>')
    expect(html).toContain("You're receiving this because you have a HireHub account.")
  })

  it('omits the CTA when cta is null', () => {
    const html = renderLayout('<p>Hello</p>', null)
    expect(html).not.toContain('display:inline-block;padding:12px 24px')
  })

  it('escapes CTA href attributes', () => {
    const html = renderLayout('<p>x</p>', { label: 'Go', href: 'https://a.com/?x=1&y=2' })
    expect(html).toContain('href="https://a.com/?x=1&amp;y=2"')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tests/email-templates.test.ts`
Expected: FAIL — `Failed to resolve import "../services/email/template"`.

- [ ] **Step 3: Write minimal implementation**

Create `src/services/email/template.ts`:

```ts
export interface Cta {
  label: string
  href: string
}

const PAGE_BG = '#f4f4f5'
const CARD_BG = '#ffffff'
const TEXT_COLOR = '#374151'
const MUTED_COLOR = '#9ca3af'
const FOOTER_COLOR = '#6b7280'
const WORDMARK_COLOR = '#111827'
const CTA_BG = '#2563eb'
const FONT_STACK = 'Arial, Helvetica, sans-serif'

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function renderLayout(bodyHtml: string, cta: Cta | null, preheader = ''): string {
  const ctaHtml = cta
    ? `<p style="margin:24px 0 0;"><a href="${escapeHtml(cta.href)}" style="display:inline-block;padding:12px 24px;background:${CTA_BG};color:#ffffff;text-decoration:none;border-radius:8px;font-family:${FONT_STACK};font-size:14px;font-weight:700;">${escapeHtml(cta.label)}</a></p>`
    : ''

  return `<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:0;background-color:${PAGE_BG};">
  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(preheader)}</div>` : ''}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${PAGE_BG};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
          <tr>
            <td style="padding-bottom:24px;">
              <img src="cid:logo-mark" width="48" height="52" alt="HireHub" style="vertical-align:middle;" />
              <span style="font-family:${FONT_STACK};font-size:20px;font-weight:700;color:${WORDMARK_COLOR};vertical-align:middle;margin-left:10px;">HireHub</span>
            </td>
          </tr>
          <tr>
            <td style="background-color:${CARD_BG};border-radius:12px;padding:32px;font-family:${FONT_STACK};font-size:15px;line-height:1.6;color:${TEXT_COLOR};">
              ${bodyHtml}
              ${ctaHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:24px 4px 0;font-family:${FONT_STACK};font-size:12px;line-height:1.5;color:${MUTED_COLOR};">
              <p style="margin:0 0 4px;font-weight:700;color:${FOOTER_COLOR};">HireHub Community</p>
              <p style="margin:0;">You're receiving this because you have a HireHub account.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/tests/email-templates.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/services/email/template.ts src/tests/email-templates.test.ts
git commit -m "feat(email): add branded email layout and HTML escaping"
```

---

### Task 2: Email content builders (`templates.ts`)

**Files:**
- Create: `src/services/email/templates.ts`
- Test: `src/tests/email-templates.test.ts` (append the `renderWelcome`/`renderStatusEmail`/`renderInterviewInvite`/`renderPasswordReset` blocks)

**Interfaces:**
- Consumes: `escapeHtml` and `renderLayout` from `./template` (Task 1).
- Produces: `EmailContent = { subject: string; html: string }`; `InterviewDetailsData` (all fields optional strings); `renderWelcome(name: string): EmailContent`; `renderStatusEmail(name, jobTitle, company, status): EmailContent`; `renderInterviewInvite(name, jobTitle, company, interviewData?: InterviewDetailsData | null): EmailContent`; `renderPasswordReset(resetUrl: string): EmailContent`.

- [ ] **Step 1: Write the failing test**

Append to `src/tests/email-templates.test.ts`:

```ts
import { env } from '../config/env'
import { renderWelcome, renderStatusEmail, renderInterviewInvite, renderPasswordReset } from '../services/email/templates'

describe('renderWelcome', () => {
  it('returns a welcome subject, greets the user, and links to APP_URL', () => {
    const { subject, html } = renderWelcome('Alice <script>')
    expect(subject).toBe('Welcome to HireHub!')
    expect(html).toContain('Hi Alice &lt;script&gt;,')
    expect(html).toContain(`href="${env.APP_URL}"`)
    expect(html).toContain('>Browse Jobs</a>')
  })
})

describe('renderStatusEmail', () => {
  it('uses status-specific copy', () => {
    const rejected = renderStatusEmail('Alice', 'Barista', 'Coffee Co', 'REJECTED')
    expect(rejected.subject).toBe('Application status update: Barista')
    expect(rejected.html).toContain('decided not to move forward')
    const offer = renderStatusEmail('Alice', 'Barista', 'Coffee Co', 'OFFER')
    expect(offer.html).toContain('Congratulations')
  })

  it('escapes user-provided job title and company', () => {
    const { html } = renderStatusEmail('Alice', '<script>', 'A&B <Co>', 'REVIEWING')
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('A&amp;B &lt;Co&gt;')
  })

  it('falls back gracefully for an unknown status', () => {
    const { html } = renderStatusEmail('Alice', 'Barista', 'Coffee Co', 'WEIRD')
    expect(html).toContain('WEIRD')
  })
})

describe('renderInterviewInvite', () => {
  it('renders scheduled details inline', () => {
    const { subject, html } = renderInterviewInvite('Alice', 'Barista', 'Coffee Co', {
      interviewType: 'video',
      interviewDate: '2026-08-12',
      interviewTime: '14:30',
      interviewerName: 'Bob',
      interviewerTitle: 'CTO',
      meetingLink: 'https://meet.example.com/x',
    })
    expect(subject).toBe('Interview invitation: Barista at Coffee Co')
    expect(html).toContain('Wednesday, August 12, 2026')
    expect(html).toContain('2:30 PM')
    expect(html).toContain('Video call')
    expect(html).toContain('https://meet.example.com/x')
    expect(html).toContain('Bob (CTO)')
    expect(html).toContain('>View Interview Details</a>')
  })

  it('uses the fallback note when interviewData is missing or has no schedule', () => {
    const missing = renderInterviewInvite('Alice', 'Barista', 'Coffee Co', null)
    expect(missing.html).toContain('finalizing the schedule')
    const partial = renderInterviewInvite('Alice', 'Barista', 'Coffee Co', { interviewDate: '2026-08-12' })
    expect(partial.html).toContain('finalizing the schedule')
  })

  it('renders a phone type and an in-person meeting location', () => {
    const { html } = renderInterviewInvite('Alice', 'Barista', 'Coffee Co', {
      interviewType: 'phone',
      interviewDate: '2026-08-12',
      interviewTime: '09:00',
      meetingLocation: '123 Main St',
    })
    expect(html).toContain('Phone call')
    expect(html).toContain('123 Main St')
    expect(html).toContain('9:00 AM')
  })

  it('does not render a dangerous meeting link', () => {
    const { html } = renderInterviewInvite('Alice', 'Barista', 'Coffee Co', {
      interviewType: 'video',
      interviewDate: '2026-08-12',
      interviewTime: '09:00',
      meetingLink: 'javascript:alert(1)',
    })
    expect(html).not.toContain('javascript:')
  })

  it('escapes the meeting link href attribute', () => {
    const { html } = renderInterviewInvite('Alice', 'Barista', 'Coffee Co', {
      interviewType: 'video',
      interviewDate: '2026-08-12',
      interviewTime: '09:00',
      meetingLink: 'https://meet.example.com/a" onclick="alert(1)',
    })
    expect(html).toContain('https://meet.example.com/a&quot; onclick=&quot;alert(1)')
    expect(html).not.toContain('href="https://meet.example.com/a"')
  })

  it('ignores a malformed date and time', () => {
    const { html } = renderInterviewInvite('Alice', 'Barista', 'Coffee Co', {
      interviewType: 'video',
      interviewDate: 'not-a-date',
      interviewTime: '25:99',
    })
    expect(html).toContain('finalizing the schedule')
  })
})

describe('renderPasswordReset', () => {
  it('renders the reset link and subject', () => {
    const { subject, html } = renderPasswordReset('https://app.example.com/reset-password?token=abc123')
    expect(subject).toBe('Reset your HireHub password')
    expect(html).toContain('https://app.example.com/reset-password?token=abc123')
    expect(html).toContain('>Reset Password</a>')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tests/email-templates.test.ts`
Expected: FAIL — `Failed to resolve import "../services/email/templates"`.

- [ ] **Step 3: Write minimal implementation**

Create `src/services/email/templates.ts`:

```ts
import { env } from '../../config/env'
import { escapeHtml, renderLayout, type Cta } from './template'

export interface EmailContent {
  subject: string
  html: string
}

export interface InterviewDetailsData {
  interviewType?: string | null
  interviewDate?: string | null
  interviewTime?: string | null
  interviewerName?: string | null
  interviewerTitle?: string | null
  meetingLink?: string | null
  meetingLocation?: string | null
}

const DASHBOARD_URL = `${env.APP_URL}/dashboard`

const INTERVIEW_TYPE_LABELS: Record<string, string> = {
  phone: 'Phone call',
  video: 'Video call',
  'in-person': 'In person',
}

function formatInterviewDate(date: string): string | null {
  const [year, month, day] = date.split('-').map(Number)
  if (!year || !month || !day) return null
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  const dt = new Date(year, month - 1, day)
  if (dt.getFullYear() !== year || dt.getMonth() !== month - 1 || dt.getDate() !== day) return null
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(dt)
}

function formatInterviewTime(time: string): string | null {
  const [hour, minute] = time.split(':').map(Number)
  if (hour === undefined || minute === undefined || Number.isNaN(hour) || Number.isNaN(minute)) return null
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null
  const dt = new Date(2000, 0, 1, hour, minute)
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(dt)
}

function safeHref(value: string | null | undefined): string | null {
  if (!value) return null
  return value.startsWith('http://') || value.startsWith('https://') ? value : null
}

export function renderWelcome(name: string): EmailContent {
  const cta: Cta = { label: 'Browse Jobs', href: env.APP_URL }
  const body = `
      <p style="margin:0 0 16px;">Hi ${escapeHtml(name)},</p>
      <p style="margin:0 0 16px;">Welcome to HireHub! Your account is ready. Browse jobs, save your favorites, and apply in minutes.</p>`
  return {
    subject: 'Welcome to HireHub!',
    html: renderLayout(body, cta, `Welcome to HireHub, ${escapeHtml(name)}`),
  }
}

const STATUS_COPY: Record<
  string,
  { headline: string; body: (jobTitle: string, company: string) => string; ctaLabel: string; ctaHref: string }
> = {
  APPLIED: {
    headline: 'Application received',
    body: (jobTitle, company) =>
      `Your application for <strong>${escapeHtml(jobTitle)}</strong> at <strong>${escapeHtml(company)}</strong> has been received and is now in the employer's hands.`,
    ctaLabel: 'View Application',
    ctaHref: DASHBOARD_URL,
  },
  REVIEWING: {
    headline: 'Application under review',
    body: (jobTitle, company) =>
      `Good news — your application for <strong>${escapeHtml(jobTitle)}</strong> at <strong>${escapeHtml(company)}</strong> is under review. We'll let you know as soon as there's an update.`,
    ctaLabel: 'View Dashboard',
    ctaHref: DASHBOARD_URL,
  },
  OFFER: {
    headline: 'You received an offer',
    body: (jobTitle, company) =>
      `Congratulations! You've received an offer for <strong>${escapeHtml(jobTitle)}</strong> at <strong>${escapeHtml(company)}</strong>. Head to your dashboard to review the details and respond.`,
    ctaLabel: 'Review Offer',
    ctaHref: DASHBOARD_URL,
  },
  REJECTED: {
    headline: 'Application not selected',
    body: (jobTitle, company) =>
      `Thank you for applying to <strong>${escapeHtml(jobTitle)}</strong> at <strong>${escapeHtml(company)}</strong>. After careful review, the employer decided not to move forward with your application this time. Many more opportunities are waiting on HireHub.`,
    ctaLabel: 'Browse Jobs',
    ctaHref: env.APP_URL,
  },
}

export function renderStatusEmail(name: string, jobTitle: string, company: string, status: string): EmailContent {
  const copy = STATUS_COPY[status] ?? {
    headline: 'Application status update',
    body: (jobTitle: string, company: string) =>
      `Your application for <strong>${escapeHtml(jobTitle)}</strong> at <strong>${escapeHtml(company)}</strong> is now: ${escapeHtml(status)}.`,
    ctaLabel: 'View Dashboard',
    ctaHref: DASHBOARD_URL,
  }
  const body = `
      <p style="margin:0 0 16px;">Hi ${escapeHtml(name)},</p>
      <p style="margin:0 0 16px;">${copy.body(jobTitle, company)}</p>`
  return {
    subject: `Application status update: ${jobTitle}`,
    html: renderLayout(body, { label: copy.ctaLabel, href: copy.ctaHref }, copy.headline),
  }
}

export function renderInterviewInvite(
  name: string,
  jobTitle: string,
  company: string,
  interviewData?: InterviewDetailsData | null,
): EmailContent {
  const details = interviewData ?? {}

  const dateLabel = details.interviewDate ? formatInterviewDate(details.interviewDate) : null
  const timeLabel = details.interviewTime ? formatInterviewTime(details.interviewTime) : null
  const typeLabel = details.interviewType
    ? INTERVIEW_TYPE_LABELS[details.interviewType] ?? escapeHtml(details.interviewType)
    : null
  const locationLabel = details.meetingLocation ? escapeHtml(details.meetingLocation) : null
  const meetingHref = safeHref(details.meetingLink)
  const interviewerLabel = details.interviewerName
    ? details.interviewerTitle
      ? `${escapeHtml(details.interviewerName)} (${escapeHtml(details.interviewerTitle)})`
      : escapeHtml(details.interviewerName)
    : null

  const hasSchedule = Boolean(dateLabel && timeLabel)

  let body: string
  if (hasSchedule) {
    const detailRow = (label: string, value: string) =>
      `<tr>
        <td style="padding:6px 0;padding-right:16px;color:#9ca3af;white-space:nowrap;font-size:14px;">${label}</td>
        <td style="padding:6px 0;font-size:14px;">${value}</td>
      </tr>`

    const rows: string[] = []
    if (dateLabel) rows.push(detailRow('Date', dateLabel))
    if (timeLabel) rows.push(detailRow('Time', timeLabel))
    if (typeLabel) rows.push(detailRow('Type', typeLabel))
    if (locationLabel) rows.push(detailRow('Where', locationLabel))
    else if (meetingHref) {
      rows.push(
        detailRow('Where', `<a href="${escapeHtml(meetingHref)}" style="color:#2563eb;">${escapeHtml(details.meetingLink ?? '')}</a>`),
      )
    }
    if (interviewerLabel) rows.push(detailRow('Interviewer', interviewerLabel))

    const detailsHtml = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0;">${rows.join('\n')}</table>`

    body = `
      <p style="margin:0 0 16px;">Hi ${escapeHtml(name)},</p>
      <p style="margin:0 0 16px;">Good news! The team at <strong>${escapeHtml(company)}</strong> would like to invite you to an interview for <strong>${escapeHtml(jobTitle)}</strong>. Here are the details:</p>
      ${detailsHtml}
      <p style="margin:16px 0 0;">Please confirm your availability in your dashboard.</p>`
  } else {
    body = `
      <p style="margin:0 0 16px;">Hi ${escapeHtml(name)},</p>
      <p style="margin:0 0 16px;">Good news! The team at <strong>${escapeHtml(company)}</strong> would like to invite you to interview for <strong>${escapeHtml(jobTitle)}</strong>. The employer is finalizing the schedule — keep an eye on your dashboard for the interview details.</p>`
  }

  return {
    subject: `Interview invitation: ${jobTitle} at ${company}`,
    html: renderLayout(body, { label: 'View Interview Details', href: DASHBOARD_URL }, 'Interview invitation'),
  }
}

export function renderPasswordReset(resetUrl: string): EmailContent {
  const body = `
      <p style="margin:0 0 16px;">We received a request to reset your HireHub password. Click the button below to choose a new one. This link expires in 1 hour.</p>
      <p style="margin:0 0 16px;">If you didn't request this, you can safely ignore this email.</p>`
  return {
    subject: 'Reset your HireHub password',
    html: renderLayout(body, { label: 'Reset Password', href: resetUrl }, 'Reset your HireHub password'),
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/tests/email-templates.test.ts`
Expected: PASS (15 tests).

- [ ] **Step 5: Commit**

```bash
git add src/services/email/templates.ts src/tests/email-templates.test.ts
git commit -m "feat(email): add welcome, status, interview, and reset email templates"
```

---

### Task 3: Resend senders with embedded logo (`index.ts`)

**Files:**
- Create: `src/services/email/logo-mark.png` (binary, via `magick`)
- Create: `src/services/email/index.ts`
- Test: `src/tests/email-delivery.test.ts`
- Delete: `src/services/email.ts`
- Modify: `package.json:8` (`build` script)
- Modify: `src/modules/applications/applications.service.ts:51` — one-line: pass `application.job.company` as the 4th arg so the call compiles against the new 5-arg `sendApplicationStatusEmail` signature (the old `email.ts` took 4 args; `application.job` is already loaded via the `include: { job: true }` in `updateStatus`, and `Job.company` is a required `String`). This keeps the "must not break `applications.service.ts`" requirement and `tsc --noEmit` exit 0 true. The interview-invite branch is NOT added here — that is Task 4.

**Interfaces:**
- Consumes: `renderWelcome`, `renderStatusEmail`, `renderInterviewInvite`, `renderPasswordReset` from `./templates` (Task 2).
- Produces (must match existing call sites): `sendWelcomeEmail(name: string, email: string): Promise<void>`; `sendPasswordResetEmail(email: string, resetUrl: string): Promise<void>`; plus `sendApplicationStatusEmail(applicantEmail, applicantName, jobTitle, company, status): Promise<void>` and `sendInterviewInviteEmail(applicantEmail, applicantName, jobTitle, company, interviewData: unknown): Promise<void>`; exported `SENDER = 'HireHub <onboarding@resend.dev>'`, `LOGO_CID = 'logo-mark'`, and `deliver(to, subject, html, client?: EmailDeliverer | null)` for tests.

- [ ] **Step 1: Write the failing test**

Create `src/tests/email-delivery.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { deliver, SENDER, LOGO_CID } from '../services/email'

function fakeClient() {
  const send = vi.fn().mockResolvedValue({ error: null })
  const client = { emails: { send } }
  return { client, send }
}

describe('deliver', () => {
  it('sends the branded payload with the embedded logo attachment', async () => {
    const { client, send } = fakeClient()
    await deliver('alice@example.com', 'Subject line', '<p>Body</p>', client)
    expect(send).toHaveBeenCalledTimes(1)
    const payload = send.mock.calls[0][0]
    expect(payload.from).toBe(SENDER)
    expect(payload.to).toBe('alice@example.com')
    expect(payload.subject).toBe('Subject line')
    expect(payload.html).toBe('<p>Body</p>')
    expect(payload.attachments).toHaveLength(1)
    expect(payload.attachments[0].filename).toBe('logo-mark.png')
    expect(payload.attachments[0].content_id).toBe(LOGO_CID)
    expect(Buffer.isBuffer(payload.attachments[0].content)).toBe(true)
    expect(payload.attachments[0].content.length).toBeGreaterThan(0)
  })

  it('skips sending when no client is provided', async () => {
    await expect(deliver('alice@example.com', 'Subject', '<p>Body</p>', null)).resolves.toBeUndefined()
  })

  it('does not throw when the send reports an error', async () => {
    const send = vi.fn().mockResolvedValue({ error: new Error('boom') })
    await expect(deliver('alice@example.com', 'Subject', '<p>Body</p>', { emails: { send } })).resolves.toBeUndefined()
    expect(send).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tests/email-delivery.test.ts`
Expected: FAIL — the import resolves to the old `src/services/email.ts`, which exports no `deliver`.

- [ ] **Step 3: Generate the logo asset**

From `hirehub-backend/`:

```bash
magick -background none ../hirehub-frontend/public/logo-mark.svg -resize 96x104 src/services/email/logo-mark.png
magick src/services/email/logo-mark.png -format "%wx%h %[channels]" info:
```

Expected second line: `96x104 srgba`.

- [ ] **Step 4: Write minimal implementation**

Create `src/services/email/index.ts`:

```ts
import { readFileSync } from 'node:fs'
import { Resend } from 'resend'
import { env } from '../../config/env'
import { logger } from '../../config/logger'
import {
  renderInterviewInvite,
  renderPasswordReset,
  renderStatusEmail,
  renderWelcome,
  type InterviewDetailsData,
} from './templates'

export const SENDER = 'HireHub <onboarding@resend.dev>'
export const LOGO_CID = 'logo-mark'
const LOGO_BUFFER = readFileSync(new URL('./logo-mark.png', import.meta.url))

export interface SendEmailPayload {
  from: string
  to: string
  subject: string
  html: string
  attachments: Array<{ filename: string; content: Buffer; content_id: string }>
}

export interface EmailDeliverer {
  emails: { send: (payload: SendEmailPayload) => Promise<{ error?: unknown }> }
}

const resend: EmailDeliverer | null = env.RESEND_API_KEY
  ? (new Resend(env.RESEND_API_KEY) as unknown as EmailDeliverer)
  : null

export async function deliver(
  to: string,
  subject: string,
  html: string,
  client: EmailDeliverer | null = resend,
): Promise<void> {
  if (!client) {
    logger.info({ to, subject }, 'Email not sent — no RESEND_API_KEY')
    return
  }
  const { error } = await client.emails.send({
    from: SENDER,
    to,
    subject,
    html,
    attachments: [{ filename: 'logo-mark.png', content: LOGO_BUFFER, content_id: LOGO_CID }],
  })
  if (error) {
    logger.error({ error, to, subject }, 'Failed to send email')
  }
}

export async function sendWelcomeEmail(name: string, email: string): Promise<void> {
  const { subject, html } = renderWelcome(name)
  await deliver(email, subject, html)
}

export async function sendApplicationStatusEmail(
  applicantEmail: string,
  applicantName: string,
  jobTitle: string,
  company: string,
  status: string,
): Promise<void> {
  const { subject, html } = renderStatusEmail(applicantName, jobTitle, company, status)
  await deliver(applicantEmail, subject, html)
}

export async function sendInterviewInviteEmail(
  applicantEmail: string,
  applicantName: string,
  jobTitle: string,
  company: string,
  interviewData: unknown,
): Promise<void> {
  const { subject, html } = renderInterviewInvite(
    applicantName,
    jobTitle,
    company,
    interviewData as InterviewDetailsData | null | undefined,
  )
  await deliver(applicantEmail, subject, html)
}

export async function sendPasswordResetEmail(email: string, resetUrl: string): Promise<void> {
  const { subject, html } = renderPasswordReset(resetUrl)
  await deliver(email, subject, html)
}
```

- [ ] **Step 5: Delete the old module and update the build script**

```bash
rm src/services/email.ts
```

Edit `package.json` line 8 (`build`) to copy the logo into `dist`:

```json
"build": "tsc && cp src/services/email/logo-mark.png dist/services/email/logo-mark.png",
```

- [ ] **Step 6: Run the delivery test to verify it passes**

Run: `npx vitest run src/tests/email-delivery.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 7: Verify the whole suite and types still pass**

Run: `npm test`
Expected: PASS — the full suite passes (prior suite + 18 new email tests across `email-templates.test.ts` (15) and `email-delivery.test.ts` (3)). The old `src/services/email.ts` deletion must not break `auth.service.ts` or `applications.service.ts` (their `../../services/email` imports now resolve to `src/services/email/index.ts`).

Run: `npx tsc --noEmit`
Expected: no type errors.

- [ ] **Step 8: Commit**

```bash
git add src/services/email/logo-mark.png src/services/email/index.ts src/services/email.ts package.json src/tests/email-delivery.test.ts src/modules/applications/applications.service.ts
git commit -m "feat(email): send branded emails with embedded logo"
```

Note: staging `src/services/email.ts` as a deletion is intentional (`git add` records the removal).

---

### Task 4: Wire the interview invite into status updates

**Files:**
- Modify: `src/modules/applications/applications.service.ts:5` and `:51-56`
- Test: `src/tests/email-triggers.test.ts`

**Interfaces:**
- Consumes: `sendApplicationStatusEmail`, `sendInterviewInviteEmail` from `../../services/email` (Task 3); `ApplicationsService.updateStatus(id, status, userId, userRole)` (existing signature, unchanged).
- Behavior: when `updateStatus` is called with `status === 'INTERVIEWING'`, call `sendInterviewInviteEmail(applicantEmail, applicantName, job.title, job.company, application.interviewData)`; for every other status call `sendApplicationStatusEmail(applicantEmail, applicantName, job.title, job.company, status)`. Both fire-and-forget with `.catch(() => {})`, matching the existing pattern.

- [ ] **Step 1: Write the failing test**

Create `src/tests/email-triggers.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { prisma } from '../lib/prisma'
import { ApplicationsService } from '../modules/applications/applications.service'
import { sendApplicationStatusEmail, sendInterviewInviteEmail } from '../services/email'

vi.mock('../services/email', () => ({
  sendWelcomeEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
  sendApplicationStatusEmail: vi.fn().mockResolvedValue(undefined),
  sendInterviewInviteEmail: vi.fn().mockResolvedValue(undefined),
}))

const service = new ApplicationsService()
let jobId = ''
let applicationId = ''
const emails: string[] = []

describe('ApplicationsService email triggers', () => {
  beforeAll(async () => {
    const employerEmail = `email-trigger-emp-${Date.now()}@example.com`
    const seekerEmail = `email-trigger-seeker-${Date.now()}@example.com`
    emails.push(employerEmail, seekerEmail)
    const employer = await prisma.user.create({
      data: { name: 'Email Employer', email: employerEmail, passwordHash: 'x', role: 'EMPLOYER', companyName: 'Email Corp' },
    })
    const seeker = await prisma.user.create({
      data: { name: 'Email Seeker', email: seekerEmail, passwordHash: 'x', role: 'SEEKER' },
    })
    const job = await prisma.job.create({
      data: {
        title: 'Email Test Job',
        company: 'Email Corp',
        location: 'Remote',
        remote: true,
        category: 'Engineering',
        seniority: 'Junior',
        description: 'Test',
        requirements: ['Python'],
        responsibilities: ['Code'],
        tags: ['python'],
        employerId: employer.id,
      },
    })
    jobId = job.id
    const application = await prisma.application.create({
      data: {
        jobId,
        userId: seeker.id,
        applicantName: 'Email Seeker',
        applicantEmail: seekerEmail,
        coverLetter: 'Please consider me',
      },
    })
    applicationId = application.id
  }, 30_000)

  afterAll(async () => {
    await prisma.application.deleteMany({ where: { id: applicationId } })
    await prisma.job.deleteMany({ where: { id: jobId } })
    await prisma.user.deleteMany({ where: { email: { in: emails } } })
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('routes a transition to INTERVIEWING to sendInterviewInviteEmail with interviewData', async () => {
    await prisma.application.update({
      where: { id: applicationId },
      data: {
        interviewData: {
          interviewType: 'video',
          interviewDate: '2026-08-12',
          interviewTime: '10:00',
          interviewerName: 'Alice',
          interviewerTitle: 'CTO',
        },
      },
    })
    await service.updateStatus(applicationId, 'INTERVIEWING', 'any-user', 'ADMIN')
    expect(sendInterviewInviteEmail).toHaveBeenCalledTimes(1)
    expect(sendInterviewInviteEmail).toHaveBeenCalledWith(
      expect.stringContaining('@example.com'),
      'Email Seeker',
      'Email Test Job',
      'Email Corp',
      expect.objectContaining({ interviewType: 'video' }),
    )
    expect(sendApplicationStatusEmail).not.toHaveBeenCalled()
  })

  it('routes other transitions to sendApplicationStatusEmail with the company', async () => {
    await service.updateStatus(applicationId, 'REVIEWING', 'any-user', 'ADMIN')
    expect(sendApplicationStatusEmail).toHaveBeenCalledTimes(1)
    expect(sendApplicationStatusEmail).toHaveBeenCalledWith(
      expect.stringContaining('@example.com'),
      'Email Seeker',
      'Email Test Job',
      'Email Corp',
      'REVIEWING',
    )
    expect(sendInterviewInviteEmail).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tests/email-triggers.test.ts`
Expected: FAIL — the first test passes but the second fails, because the current `updateStatus` sends `sendApplicationStatusEmail(..., status)` without a `company` argument (and never calls `sendInterviewInviteEmail`). (The `sendApplicationStatusEmail` mock still receives 4 args from the current code, so the `toHaveBeenCalledWith(..., 'Email Corp', 'REVIEWING')` assertion fails on the missing argument; the interview test fails on `sendInterviewInviteEmail` never being called.)

- [ ] **Step 3: Write minimal implementation**

Edit `src/modules/applications/applications.service.ts`:

Change line 5 from:

```ts
import { sendApplicationStatusEmail } from '../../services/email'
```

to:

```ts
import { sendApplicationStatusEmail, sendInterviewInviteEmail } from '../../services/email'
```

Change lines 51-56 from:

```ts
    sendApplicationStatusEmail(
      application.applicantEmail,
      application.applicantName,
      application.job.title,
      status,
    ).catch(() => {})
```

to:

```ts
    if (status === 'INTERVIEWING') {
      sendInterviewInviteEmail(
        application.applicantEmail,
        application.applicantName,
        application.job.title,
        application.job.company,
        application.interviewData,
      ).catch(() => {})
    } else {
      sendApplicationStatusEmail(
        application.applicantEmail,
        application.applicantName,
        application.job.title,
        application.job.company,
        status,
      ).catch(() => {})
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/tests/email-triggers.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Verify the whole suite and types still pass**

Run: `npm test`
Expected: PASS — full suite green, including the existing `applications-hiring-flow.test.ts` `INTERVIEWING` transition (with no interviewData set, the real (unmocked) email module is used, no key is present, and the fallback path logs-and-skips).

Run: `npx tsc --noEmit`
Expected: no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/modules/applications/applications.service.ts src/tests/email-triggers.test.ts
git commit -m "feat(email): send interview invite on INTERVIEWING status"
```

---

## Post-Plan Manual Verification (not part of task commits)

Live-send smoke test against the real Resend API and an inbox. Requires the dev server and a working key.

1. Set a working key in `hirehub-backend/.env` (gitignored — do not commit):
   `RESEND_API_KEY="re_..."`

2. Start the API: `npm run dev`.

3. Welcome email — register a fresh seeker:
   ```bash
   curl -s -X POST http://localhost:4000/api/auth/register \
     -H 'Content-Type: application/json' \
     -d '{"name":"Email Test","email":"<your-inbox>@example.com","password":"password123"}'
   ```
   Expect: `Welcome to HireHub!` in the inbox, logo mark rendered above the wordmark, `Browse Jobs` CTA pointing at `http://localhost:5173`.

4. Interview email — create an employer, promote it to ADMIN (bypasses the `application:update` permission gate), create a job + application, then move the application to `INTERVIEWING`:
   ```bash
   # register employer, then promote via prisma
   npx tsx -e "import {prisma} from './src/lib/prisma'; prisma.user.update({where:{email:'<employer-inbox>@example.com'},data:{role:'ADMIN'}})"
   TOKEN=$(curl -s -X POST http://localhost:4000/api/auth/login -H 'Content-Type: application/json' -d '{"email":"<employer-inbox>@example.com","password":"password123"}' | jq -r '.data.accessToken')
   JOB=$(curl -s -X POST http://localhost:4000/api/jobs -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"title":"Interview Test Role","company":"Email Corp","location":"Remote","remote":true,"category":"Engineering","seniority":"Mid","description":"Test","requirements":["Node"],"responsibilities":["Code"],"tags":["node"]}' | jq -r '.data.id')
   # register seeker and capture token
   SEEKER=$(curl -s -X POST http://localhost:4000/api/auth/register -H 'Content-Type: application/json' -d '{"name":"Seeker","email":"<seeker-inbox>@example.com","password":"password123"}' | jq -r '.data.accessToken')
   APP=$(curl -s -X POST http://localhost:4000/api/applications -H "Authorization: Bearer $SEEKER" -H 'Content-Type: application/json' -d "{\"jobId\":\"$JOB\",\"applicantName\":\"Seeker\",\"applicantEmail\":\"<seeker-inbox>@example.com\",\"coverLetter\":\"Please consider me\"}" | jq -r '.data.id')
   curl -s -X PATCH "http://localhost:4000/api/applications/$APP/status" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"status":"INTERVIEWING"}'
   ```
   Expect: an interview invite in the seeker's inbox. Without `interviewData` it shows the "finalizing the schedule" fallback. To see the full details variant, set `interviewData` first (e.g. `PATCH /api/applications/:id/hiring-data` with `{"interviewData":{"interviewType":"video","interviewDate":"2026-08-12","interviewTime":"10:00","meetingLink":"https://meet.example.com/x","interviewerName":"Alice","interviewerTitle":"CTO"}}`) before flipping the status.

5. Status emails — repeat the transition with `REVIEWING` (and optionally `OFFER`/`REJECTED`) and confirm the per-status copy and CTA render with the logo header.
