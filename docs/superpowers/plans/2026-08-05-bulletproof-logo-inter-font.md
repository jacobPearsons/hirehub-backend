# Bulletproof Logo + Inter Webfont Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the HireHub H-mark render inline in every email client (no CID attachment / download chip) and render email body text in the Inter brand font with a system fallback.

**Architecture:** Replace the `<img src="cid:logo-mark">` in `renderLayout` with a bulletproof nested-table logo built from inline styles and `background-color` cells (no image, no attachment), and load Inter via a `<style>` `@import` with a `font-family` stack fallback. Task 1 swaps the template markup and updates its tests; Task 2 strips the now-unused attachment machinery (`LOGO_CID`, `LOGO_BUFFER`, attachment payload, PNG asset, build `cp` step) and reworks the delivery test.

**Tech Stack:** TypeScript (strict), Vitest, Node.js, plain-HTML email templates served via Resend.

## Global Constraints

- Repo `hirehub-backend`, branch `feat/onboarding-wizard`. Commit directly; never create/switch branches or use a worktree.
- Never run `git add -A` / `git add .` — stage only the exact files each task names.
- Verify from `hirehub-backend/`: `npm test`, `npx tsc --noEmit`, `npm run build` (Task 2).
- The logo MUST be pure HTML tables + inline styles. No `<img>`, no data URI, no SVG, no attachments anywhere in the final output.
- Exact constants: logo tile `#ff5600`, logo bars `#ffffff`, wordmark `#111827`; page bg `#f4f4f5`, card `#ffffff`, body text `#374151`, muted `#9ca3af`, footer label `#6b7280`, CTA bg `#2563eb`.
- `FONT_STACK` must be exactly `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif`.
- The `@import` line must be exactly `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap');` and be the first line of the `<style>` block.
- No new dependencies. Test count stays 163 (tests are modified, none added).

---

### Task 1: Bulletproof logo + Inter font in `template.ts`

**Files:**
- Modify: `src/services/email/template.ts` (constants, `<style>`/`<head>`, header logo markup, `FONT_STACK`)
- Test: `src/tests/email-templates.test.ts:16-24` (replace the "logo cid" test)

**Interfaces:**
- Consumes: existing `escapeHtml(value: unknown): string`, `Cta { label, href }`, `renderLayout(bodyHtml: string, cta: Cta | null, preheader = ''): string` — signatures unchanged.
- Produces: `renderLayout` now emits a `<head><style>@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap');</style></head>`, a bulletproof 40×40 logo table (no `cid:` reference), and `font-family:'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif` on all styled text. `escapeHtml` and the CTA markup are unchanged.

- [ ] **Step 1: Write the failing test**

Replace the test at `src/tests/email-templates.test.ts:16-24` (the first `it` inside `describe('renderLayout', ...)`):

```ts
  it('includes preheader, bulletproof logo, wordmark, body, CTA, and footer', () => {
    const html = renderLayout('<p>Hello</p>', { label: 'Go', href: 'https://example.com' }, 'A preheader')
    expect(html).toContain('A preheader')
    expect(html).toContain('background-color:#ff5600')
    expect(html).toContain("font-family:'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif")
    expect(html).toContain("@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap');")
    expect(html).toContain('>HireHub</span>')
    expect(html).toContain('<p>Hello</p>')
    expect(html).toContain('>Go</a>')
    expect(html).toContain("You're receiving this because you have a HireHub account.")
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tests/email-templates.test.ts`
Expected: FAIL — the current template emits `src="cid:logo-mark"` and `font-family:Arial, Helvetica, sans-serif` with no `#ff5600` tile, so the new assertions fail.

- [ ] **Step 3: Write minimal implementation**

Replace the entire contents of `src/services/email/template.ts` with:

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
const LOGO_BG = '#ff5600'
const LOGO_BAR = '#ffffff'
const FONT_STACK = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif"
const FONT_IMPORT = "@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap');"

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
<head>
  <style>${FONT_IMPORT}</style>
</head>
<body style="margin:0;padding:0;background-color:${PAGE_BG};">
  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(preheader)}</div>` : ''}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${PAGE_BG};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
          <tr>
            <td style="padding-bottom:24px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="40" height="40" style="width:40px;height:40px;">
                <tr>
                  <td align="center" valign="middle" width="40" height="40" bgcolor="${LOGO_BG}" style="width:40px;height:40px;background-color:${LOGO_BG};border-radius:8px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td width="8">&nbsp;</td>
                        <td width="4" height="24" bgcolor="${LOGO_BAR}" style="width:4px;height:24px;background-color:${LOGO_BAR};border-radius:2px;">&nbsp;</td>
                        <td width="16" height="5" bgcolor="${LOGO_BAR}" style="width:16px;height:5px;background-color:${LOGO_BAR};border-radius:2px;">&nbsp;</td>
                        <td width="4" height="24" bgcolor="${LOGO_BAR}" style="width:4px;height:24px;background-color:${LOGO_BAR};border-radius:2px;">&nbsp;</td>
                        <td width="8">&nbsp;</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
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
Expected: PASS (16 tests). The other `renderLayout` tests ('omits the CTA', 'escapes CTA href attributes') must still pass — the CTA markup is unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/services/email/template.ts src/tests/email-templates.test.ts
git commit -m "feat(email): render logo as bulletproof HTML and use Inter font"
```

---

### Task 2: Remove the attachment machinery

**Files:**
- Modify: `src/services/email/index.ts` (remove `LOGO_CID`, `LOGO_BUFFER`, `readFileSync` import, `attachments` payload field, and the attachment in `deliver`)
- Delete: `src/services/email/logo-mark.png`
- Modify: `package.json:8` (`build` script → `tsc`)
- Test: `src/tests/email-delivery.test.ts:1-25` (import line + first test)

**Interfaces:**
- Consumes: `SENDER = 'HireHub <onboarding@resend.dev>'` and `deliver(to: string, subject: string, html: string, client?: EmailDeliverer | null)` from Task 1's unchanged signatures; the four senders (`sendWelcomeEmail`, `sendPasswordResetEmail`, `sendApplicationStatusEmail`, `sendInterviewInviteEmail`) are unchanged.
- Produces: `SendEmailPayload` is now `{ from, to, subject, html }` — no `attachments`. `LOGO_CID` is removed (nothing imports it after this task: verified — only `email-delivery.test.ts` referenced it). `deliver` sends the same payload minus attachments. The build emits only JS (no asset copy).

- [ ] **Step 1: Write the failing test**

Replace the first `it` block in `src/tests/email-delivery.test.ts` (lines 11-25) and its import line (line 2):

```ts
import { deliver, SENDER } from '../services/email'
```

```ts
  it('sends the payload without attachments', async () => {
    const { client, send } = fakeClient()
    await deliver('alice@example.com', 'Subject line', '<p>Body</p>', client)
    expect(send).toHaveBeenCalledTimes(1)
    const payload = send.mock.calls[0][0]
    expect(payload.from).toBe(SENDER)
    expect(payload.to).toBe('alice@example.com')
    expect(payload.subject).toBe('Subject line')
    expect(payload.html).toBe('<p>Body</p>')
    expect(payload.attachments).toBeUndefined()
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tests/email-delivery.test.ts`
Expected: FAIL — `deliver` still attaches `logo-mark.png`, so `payload.attachments` is defined; also `LOGO_CID` no longer resolves once the import is updated (the file must be edited in Step 1 for the import change).

- [ ] **Step 3: Write minimal implementation**

3a. Replace the entire contents of `src/services/email/index.ts` with:

```ts
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

export interface SendEmailPayload {
  from: string
  to: string
  subject: string
  html: string
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

3b. Delete the logo asset: `git rm src/services/email/logo-mark.png`

3c. Change `package.json` line 8 from `"build": "tsc && cp src/services/email/logo-mark.png dist/services/email/logo-mark.png"` to `"build": "tsc"`.

- [ ] **Step 4: Run tests and typecheck to verify they pass**

Run: `npx vitest run src/tests/email-delivery.test.ts`
Expected: PASS (3 tests).

Run: `npx vitest run src/tests/email-templates.test.ts`
Expected: PASS (16 tests).

Run: `npm test`
Expected: PASS — full suite (163 tests).

Run: `npx tsc --noEmit`
Expected: no type errors. `auth.service.ts` and `applications.service.ts` still compile — their imports only reference `SENDER`, the four senders, and `deliver`, all unchanged.

Run: `npm run build`
Expected: success (plain `tsc`; no missing asset, no cp step).

- [ ] **Step 5: Commit**

```bash
git add src/services/email/index.ts package.json src/tests/email-delivery.test.ts
git commit -m "refactor(email): remove attachment logo, rely on bulletproof HTML logo"
```

(Note: the `git rm` in Step 3b already staged the PNG deletion.)

---

## Post-implementation verification (not a task)

After both tasks, send the 4 preview emails to `sarafiore647@gmail.com` (the Resend account owner) via a temporary `npx tsx` script that imports the real senders from `../src/services/email`, then confirm in the inbox that the logo renders inline (no download chip) and the text uses Inter/fallback.
