import { describe, it, expect } from 'vitest'
import { ALLOWED_TRANSITIONS, canTransition } from '../modules/applications/status-transitions'

describe('Status transition matrix', () => {
  it('exposes the expected legal transition matrix', () => {
    expect(ALLOWED_TRANSITIONS).toEqual({
      APPLIED: ['SCREENING', 'SHORTLIST', 'REJECTED', 'WITHDRAWN'],
      SCREENING: ['SHORTLIST', 'INTERVIEWING', 'REJECTED', 'WITHDRAWN', 'APPLIED'],
      SHORTLIST: ['INTERVIEWING', 'OFFER', 'REJECTED', 'WITHDRAWN'],
      INTERVIEWING: ['OFFER', 'REJECTED', 'WITHDRAWN'],
      OFFER: ['HIRED', 'REJECTED', 'WITHDRAWN'],
      HIRED: [],
      REJECTED: [],
      WITHDRAWN: [],
    })
  })

  it('allows every legal transition in each matrix row', () => {
    for (const [from, tos] of Object.entries(ALLOWED_TRANSITIONS)) {
      for (const to of tos) {
        expect(canTransition(from as Parameters<typeof canTransition>[0], to as Parameters<typeof canTransition>[0])).toBe(true)
      }
    }
  })

  it('rejects illegal transitions', () => {
    expect(canTransition('APPLIED', 'OFFER')).toBe(false)
    expect(canTransition('OFFER', 'SCREENING')).toBe(false)
    expect(canTransition('HIRED', 'REJECTED')).toBe(false)
    expect(canTransition('REJECTED', 'HIRED')).toBe(false)
    expect(canTransition('APPLIED', 'HIRED')).toBe(false)
    expect(canTransition('APPLIED', 'APPLIED')).toBe(false)
    expect(canTransition('HIRED', 'WITHDRAWN')).toBe(false)
    expect(canTransition('WITHDRAWN', 'SCREENING')).toBe(false)
  })
})
