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
