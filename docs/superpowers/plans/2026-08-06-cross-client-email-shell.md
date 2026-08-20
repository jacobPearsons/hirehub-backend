# Cross-Client Email Shell — Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the backend transactional email shell (`src/services/email/template.ts`) to the email-engineering skill's cross-client standard — Outlook ghost table + `PixelsPerInch`, dark-mode CSS for both `prefers-color-scheme` and Outlook `[data-ogsc]`, `bgcolor` + `background-color` on every colored cell, and a bulletproof CTA — without changing any sender signature or template copy.

**Architecture:** The change is confined to `renderLayout()` in `template.ts`. `templates.ts` and `index.ts` are untouched, so every existing sender (`sendWelcomeEmail`, `sendApplicationStatusEmail`, `sendInterviewInviteEmail`, `sendPasswordResetEmail`) keeps its exact behavior. The existing table-based layout is preserved; we add the `<head>` hardening (meta tags, dark-mode `<style>` block, MSO settings), wrap the 560px container in an MSO ghost table, add `bgcolor`/classes to colored cells, and replace the inline CTA anchor with a table-based bulletproof button. Tests are extended in `src/tests/email-templates.test.ts`.

**Tech Stack:** TypeScript, Vitest, Node 20+, Express/Prisma backend. Design tokens already defined in `template.ts` (light) plus new dark-mode constants.

## Global Constraints

- Repo: `hirehub-backend` at `/home/jacobp/Desktop/Projecs/hirehub-backend`, branch `feat/onboarding-wizard`. Never create or switch branches; work in the current working tree and commit directly on the current branch.
- Never `git add -A` or `git add .` — stage only the task-named files.
- TDD: write the failing test first, run to confirm it fails, implement, run to confirm it passes.
- Verification commands (from repo root): `npx tsc --noEmit` and `npx vitest run`. Baseline: 163 tests pass, tsc clean.
- Do NOT modify `src/services/email/index.ts` or `src/services/email/templates.ts`. `renderLayout(bodyHtml, cta, preheader = '')` keeps its exact signature and `escapeHtml` keeps its exact signature. No new dependencies.
- Email standards (email-engineering skill) — `renderLayout` output MUST contain: `<meta name="color-scheme" content="light dark">`, `<meta name="supported-color-schemes" content="light dark">`, a `@media (prefers-color-scheme: dark)` block AND an Outlook `[data-ogsc]` block, an MSO ghost table wrapping the container + `<o:PixelsPerInch>96</o:PixelsPerInch>`, `bgcolor` + `background-color` on every colored cell, bulletproof CTA (table wrapper, padding on the `<td>`, `display:inline-block` on the `<a>`), `<html lang="en">`, `role="presentation"` + `border="0"` on all layout tables, preheader hidden div, and footer copy "You're receiving this because you have a HireHub account."
- Design tokens (light, already in file): page bg `#f4f4f5`, card `#ffffff`, text `#374151`, muted `#9ca3af`, footer `#6b7280`, wordmark `#111827`, CTA `#2563eb`, logo tile `#ff5600`, logo bars `#ffffff`. New dark-mode constants: bg `#1a1a1a`, card `#2d2d2d`, text `#e5e7eb`, muted `#9ca3af`, link `#4da6ff`. Container max-width `560px`.
- Existing tests in `email-templates.test.ts` must keep passing (they assert on preheader, `background-color:#ff5600`, the Inter font-family, the `@import` font string, `>HireHub</span>`, `<p>Hello</p>`, `>Go</a>`, the footer line, CTA omission when null, and CTA href escaping).
- Commit style follows repo history (`feat(emails): ...`). Commit after each task's green verification, staging only that task's files.

---

### Task 1: Cross-client shell in `renderLayout`

**Files:**
- Modify: `src/services/email/template.ts`
- Test: `src/tests/email-templates.test.ts`

**Interfaces:**
- Consumes: existing `Cta`, `escapeHtml`, `renderLayout` signatures (unchanged).
- Produces: `renderLayout` output hardened per Global Constraints; dark-mode CSS classes `email-bg`, `email-card`, `text-muted`, `text-footer`, `wordmark`, `cta-button`; body paragraph/heading dark overrides via `.email-card .text-body, .email-card h1, .email-card h2, .email-card h3`.

- [ ] **Step 1: Write the failing tests**

Append to `src/tests/email-templates.test.ts` (after the existing `describe('renderLayout', ...)` block):

```ts
describe('renderLayout cross-client shell', () => {
  it('includes color-scheme meta tags and Outlook PixelsPerInch', () => {
    const html = renderLayout('<p>x</p>', null)
    expect(html).toContain('<meta name="color-scheme" content="light dark" />')
    expect(html).toContain('<meta name="supported-color-schemes" content="light dark" />')
    expect(html).toContain('<o:PixelsPerInch>96</o:PixelsPerInch>')
  })

  it('includes dark-mode CSS for prefers-color-scheme and Outlook data-ogsc', () => {
    const html = renderLayout('<p>x</p>', null)
    expect(html).toContain('@media (prefers-color-scheme: dark)')
    expect(html).toContain('[data-ogsc]')
    expect(html).toContain('.email-card { background-color: #2d2d2d !important; }')
    expect(html).toContain('.wordmark { color: #e5e7eb !important; }')
  })

  it('wraps the 560px container in an MSO ghost table', () => {
    const html = renderLayout('<p>x</p>', null)
    expect(html).toContain('<!--[if mso]>')
    expect(html).toContain('width="560" align="center"')
  })

  it('declares bgcolor alongside background-color on the page and card', () => {
    const html = renderLayout('<p>x</p>', null)
    expect(html).toContain('bgcolor="#f4f4f5"')
    expect(html).toContain('bgcolor="#ffffff"')
    expect(html).toContain('background-color:#ffffff')
  })

  it('renders a bulletproof CTA table', () => {
    const html = renderLayout('<p>x</p>', { label: 'Go', href: 'https://example.com' })
    expect(html).toContain('<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 0;">')
    expect(html).toContain('bgcolor="#2563eb"')
    expect(html).toContain('display:inline-block;padding:12px 24px')
    expect(html).toContain('>Go</a>')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/tests/email-templates.test.ts`
Expected: FAIL — the new describe block fails every assertion (no meta tags, no ghost table, no `[data-ogsc]`, plain CTA anchor).

- [ ] **Step 3: Rewrite `src/services/email/template.ts`**

Replace the entire file with:

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
const DARK_BG = '#1a1a1a'
const DARK_CARD = '#2d2d2d'
const DARK_TEXT = '#e5e7eb'
const DARK_LINK = '#4da6ff'
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

function bulletproofCta(cta: Cta): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 0;">
    <tr>
      <td bgcolor="${CTA_BG}" style="background-color:${CTA_BG};border-radius:8px;">
        <a class="cta-button" href="${escapeHtml(cta.href)}" style="display:inline-block;padding:12px 24px;font-family:${FONT_STACK};font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:8px;">${escapeHtml(cta.label)}</a>
      </td>
    </tr>
  </table>`
}

function darkModeStyles(): string {
  return `@media (prefers-color-scheme: dark) {
    .email-bg { background-color: ${DARK_BG} !important; }
    .email-card { background-color: ${DARK_CARD} !important; }
    .email-card .text-body, .email-card h1, .email-card h2, .email-card h3 { color: ${DARK_TEXT} !important; }
    .text-muted { color: ${MUTED_COLOR} !important; }
    .text-footer { color: ${MUTED_COLOR} !important; }
    .wordmark { color: ${DARK_TEXT} !important; }
    a { color: ${DARK_LINK} !important; }
  }
  [data-ogsc] .email-bg { background-color: ${DARK_BG} !important; }
  [data-ogsc] .email-card { background-color: ${DARK_CARD} !important; }
  [data-ogsc] .email-card .text-body, [data-ogsc] .email-card h1, [data-ogsc] .email-card h2, [data-ogsc] .email-card h3 { color: ${DARK_TEXT} !important; }
  [data-ogsc] .text-muted { color: ${MUTED_COLOR} !important; }
  [data-ogsc] .text-footer { color: ${MUTED_COLOR} !important; }
  [data-ogsc] .wordmark { color: ${DARK_TEXT} !important; }
  [data-ogsc] a { color: ${DARK_LINK} !important; }`
}

export function renderLayout(bodyHtml: string, cta: Cta | null, preheader = ''): string {
  const ctaHtml = cta ? bulletproofCta(cta) : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
  <style>${FONT_IMPORT}
${darkModeStyles()}
  </style>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body class="email-bg" style="margin:0;padding:0;background-color:${PAGE_BG};">
  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(preheader)}</div>` : ''}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${PAGE_BG}" style="background-color:${PAGE_BG};">
    <tr>
      <td align="center" bgcolor="${PAGE_BG}" style="background-color:${PAGE_BG};padding:32px 16px;">
        <!--[if mso]>
        <table role="presentation" width="560" align="center" cellpadding="0" cellspacing="0" border="0"><tr><td>
        <![endif]-->
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
              <span class="wordmark" style="font-family:${FONT_STACK};font-size:20px;font-weight:700;color:${WORDMARK_COLOR};vertical-align:middle;margin-left:10px;">HireHub</span>
            </td>
          </tr>
          <tr>
            <td class="email-card" bgcolor="${CARD_BG}" style="background-color:${CARD_BG};border-radius:12px;padding:32px;font-family:${FONT_STACK};font-size:15px;line-height:1.6;color:${TEXT_COLOR};">
              ${bodyHtml}
              ${ctaHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:24px 4px 0;font-family:${FONT_STACK};font-size:12px;line-height:1.5;color:${MUTED_COLOR};">
              <p class="text-footer" style="margin:0 0 4px;font-weight:700;color:${FOOTER_COLOR};">HireHub Community</p>
              <p class="text-muted" style="margin:0;">You're receiving this because you have a HireHub account.</p>
            </td>
          </tr>
        </table>
        <!--[if mso]>
        </td></tr></table>
        <![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>`
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/tests/email-templates.test.ts`
Expected: PASS — all pre-existing tests (escapeHtml, renderLayout, renderWelcome, renderStatusEmail, renderInterviewInvite, renderPasswordReset) plus the 5 new cross-client shell tests.

- [ ] **Step 5: Typecheck and full suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: tsc clean, all 163 baseline tests + 5 new tests pass. This also proves `templates.ts`/`index.ts` senders compile against the unchanged `renderLayout` signature.

- [ ] **Step 6: Commit**

```bash
git add src/services/email/template.ts src/tests/email-templates.test.ts
git commit -m "feat(emails): harden email shell for Outlook and dark mode"
```

---

### Task 2: Full verification

**Files:**
- Modify: none (verification only). If any verification step fails, fix the failure in the task that owns the file, then re-run.

- [ ] **Step 1: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit code 0, no output.

- [ ] **Step 2: Full test suite**

Run: `npx vitest run`
Expected: all tests pass (163 baseline + 5 new email shell tests).

- [ ] **Step 3: Confirm clean working tree of task files**

Run: `git status --short`
Expected: `template.ts` and `email-templates.test.ts` committed; no other files modified by this plan.

- [ ] **Step 4: Commit if the verification pass produced no changes (no-op)**

Run: `git status --short`
Expected: nothing new to commit for this task. Do not create an empty commit.
