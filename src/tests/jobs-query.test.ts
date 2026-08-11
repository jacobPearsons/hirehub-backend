import { describe, it, expect } from 'vitest'
import { listJobsQuerySchema, encodeCursor, decodeCursor } from '../modules/jobs/jobs.query'

describe('jobs query schema', () => {
  it('parses a valid query and coerces take', () => {
    const out = listJobsQuerySchema.parse({
      search: 'react', location: 'austin', take: '20', remote: 'true',
    })
    expect(out.take).toBe(20)
    expect(out.remote).toBe('true')
  })

  it('caps take at 100 and leaves sort optional', () => {
    const out = listJobsQuerySchema.parse({ take: '500' })
    expect(out.take).toBe(100)
    expect(out.sort).toBeUndefined()
  })

  it('parses the random sort', () => {
    const out = listJobsQuerySchema.parse({ sort: 'random' })
    expect(out.sort).toBe('random')
  })

  it('rejects unknown sort values', () => {
    expect(() => listJobsQuerySchema.parse({ sort: 'bogus' })).toThrow()
  })
})

describe('cursor codec', () => {
  it('round-trips a cursor', () => {
    const cursor = encodeCursor({ postedDate: '2026-01-01T00:00:00Z', id: 'abc' })
    expect(decodeCursor(cursor)).toEqual({ postedDate: '2026-01-01T00:00:00Z', id: 'abc' })
  })

  it('returns null for garbage', () => {
    expect(decodeCursor('!!not-json!!')).toBeNull()
    expect(decodeCursor(undefined)).toBeNull()
  })
})
