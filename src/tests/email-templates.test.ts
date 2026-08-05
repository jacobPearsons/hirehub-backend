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
