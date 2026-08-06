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
