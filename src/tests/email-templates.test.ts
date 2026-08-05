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
