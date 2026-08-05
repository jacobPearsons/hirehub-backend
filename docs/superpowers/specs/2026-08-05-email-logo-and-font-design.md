# HireHub Emails: Bulletproof Logo + Inter Webfont — Design

Date: 2026-08-05
Status: Approved (user approved design 2026-08-05)
Repo: `hirehub-backend`, branch `feat/onboarding-wizard`

## Context

The branded transactional emails (welcome, application status, interview invite, password reset) were shipped with the logo embedded as a **CID inline attachment** (`cid:logo-mark`) and body text in `Arial, Helvetica, sans-serif`. Live preview to the Resend account owner revealed two problems:

1. **Logo shows as a downloadable attachment chip** in Gmail instead of rendering inline in the email body. This is the well-known CID behavior: Gmail surfaces inline attachments as download chips; Outlook desktop strips them entirely.
2. **Text does not match the app's look.** The HireHub frontend brands with **Inter** (`@fontsource/inter`), but the emails hardcode `Arial`. The email text should match the app.

The user's suggested fixes — base64 data URIs and inline SVG — were evaluated and rejected: Gmail, Outlook.com, and Outlook desktop strip or block both. They are the least reliable options in email.

## Goals

- The HireHub H-mark renders **inline, immediately, in every email client** — no download chip, no "display images" prompt, no attachment.
- Email text uses **Inter** where webfonts are supported (Gmail, Apple Mail), with a clean system fallback elsewhere (Outlook).
- Zero new dependencies; no hosting required; works on localhost.
- Tests verify real behavior; the change is fully covered by the existing test suite (now 163 tests).

## Non-Goals

- **No hosted image URL** — the app has no public domain yet. (Designed so swapping to a hosted URL later is a one-line change.)
- **No base64 data URIs, no inline SVG** — rejected for client compatibility.
- **No attachments of any kind** — the attachment mechanism is removed entirely; nothing is attached to the email.
- **No changes to sender identity, subjects, copy, or content structure** — only the logo rendering and font.

## Design Decisions

### 1. Bulletproof HTML logo

Replace the `<img src="cid:logo-mark">` with a nested-table logo that reproduces the SVG geometry (`logo-mark.svg`: 48×52 viewBox, orange `#ff5600` rounded rect, three white round-capped strokes forming the H):

- Outer tile: 40×40, `background-color:#ff5600`, `border-radius:8px` (rounds in modern webmail; falls back to square corners in Outlook desktop, acceptable at logo size).
- Inner single-row table (cellpadding/cellspacing 0): `[pad 8][left bar 4×24][connector 16×5][right bar 4×24][pad 8]` = 40px wide.
- White bars: `background-color:#ffffff`, `border-radius:2px` (round caps, mirroring `stroke-linecap="round"`).
- Vertical bars 24px tall are vertically centered; the 5px connector centers in the 24px row, placing it at the tile's vertical center — reproducing the H.
- Wordmark span `HireHub` (color `#111827`, weight 700) remains adjacent, now in the Inter stack.

The connector is 16px wide (touching both bars' inner edges) so the mark reads as a clear H.

**HTML sketch (inline styles; `&nbsp;` fills empty spacer cells):**

```html
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="40" height="40" style="width:40px;height:40px;">
  <tr>
    <td align="center" valign="middle" width="40" height="40" bgcolor="#ff5600"
        style="width:40px;height:40px;background-color:#ff5600;border-radius:8px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td width="8">&nbsp;</td>
          <td width="4" height="24" bgcolor="#ffffff" style="width:4px;height:24px;background-color:#ffffff;border-radius:2px;">&nbsp;</td>
          <td width="16" height="5" bgcolor="#ffffff" style="width:16px;height:5px;background-color:#ffffff;border-radius:2px;">&nbsp;</td>
          <td width="4" height="24" bgcolor="#ffffff" style="width:4px;height:24px;background-color:#ffffff;border-radius:2px;">&nbsp;</td>
          <td width="8">&nbsp;</td>
        </tr>
      </table>
    </td>
  </tr>
</table>
```

### 2. Inter webfont with fallback

- Prepend `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap');` as the **first line of the `<style>` block** in `renderLayout` (Gmail requires the `@import` to lead the style block; this is the supported webfont path).
- Change the shared constant to `FONT_STACK = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif"`.
- All five `font-family` usages in `template.ts` flow from `FONT_STACK`; the card cell sets it and body content inherits. `templates.ts` content builders hardcode no fonts.

## File Changes

- **`src/services/email/template.ts`**: swap `<img>` for the bulletproof table; add the `@import`; update `FONT_STACK`.
- **`src/services/email/index.ts`**: remove `LOGO_CID`, `LOGO_BUFFER`, the `readFileSync` import, the `attachments` field in `SendEmailPayload`, and the attachment from `deliver`. No other signature changes (`SENDER`, `deliver(to, subject, html, client?)`, and the four senders stay identical).
- **`src/services/email/logo-mark.png`**: deleted (no longer referenced).
- **`package.json`**: `build` reverts to `tsc` (the `cp ... logo-mark.png` step is removed).
- **`src/tests/email-templates.test.ts`**: the "logo cid" assertion becomes a bulletproof-logo assertion (`background-color:#ff5600`, white bars).
- **`src/tests/email-delivery.test.ts`**: attachment assertions are replaced with clean-payload assertions (no `attachments`; `from` = `SENDER`, correct `to`/`subject`/`html`).

## Testing

- `npx vitest run src/tests/email-templates.test.ts` — 16 tests, updated logo assertions pass.
- `npx vitest run src/tests/email-delivery.test.ts` — 3 tests, reworked payload assertions pass.
- `npm test` — full suite (163 tests) passes; the delivery-test rework and template-test updates are the only test changes.
- `npx tsc --noEmit` — clean.
- Manual: resend the 4 preview emails via the real Resend key and confirm the logo renders inline (no download chip) and text renders in Inter/fallback.

## Migration / Follow-ups

- The plan doc for the original email rebrand is `docs/superpowers/plans/2026-08-05-branded-transactional-emails.md` (all tasks complete). This design supersedes its logo/font decisions.
- Swapping to a hosted URL later: replace the bulletproof table with `<img src="{{public_logo_url}}" width="40" height="40" alt="HireHub">`; keep the wordmark. One-line change in `template.ts`.
