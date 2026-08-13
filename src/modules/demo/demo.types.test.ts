import { describe, it, expect } from 'vitest'
import { DEMO_CANDIDATE_EMAILS, DEMO_COMPANY, isDemoCandidateEmail } from './demo.types'

describe('demo constants', () => {
  it('recognizes reserved demo candidate emails', () => {
    for (const email of DEMO_CANDIDATE_EMAILS) {
      expect(isDemoCandidateEmail(email)).toBe(true)
    }
  })

  it('accepts any candidate in the reserved range', () => {
    expect(isDemoCandidateEmail('demo.candidate99@hirehub.community')).toBe(true)
  })

  it('rejects real user emails and empty strings', () => {
    expect(isDemoCandidateEmail('alex@example.com')).toBe(false)
    expect(isDemoCandidateEmail('employer@hirehub.community')).toBe(false)
    expect(isDemoCandidateEmail('demo.candidate@hirehub.community')).toBe(false)
    expect(isDemoCandidateEmail('')).toBe(false)
  })

  it('defines the demo company', () => {
    expect(DEMO_COMPANY).toBe('HireHub')
  })
})
