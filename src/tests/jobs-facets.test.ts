import { describe, it, expect } from 'vitest'
import request from 'supertest'
import app from '../app/app'

describe('GET /api/jobs/tags/search', () => {
  it('returns matching tags with counts', async () => {
    const res = await request(app).get('/api/jobs/tags/search').query({ q: 're' }).expect(200)
    expect(res.body.success).toBe(true)
    expect(Array.isArray(res.body.data)).toBe(true)
    for (const tag of res.body.data) {
      expect(typeof tag.name).toBe('string')
      expect(typeof tag.count).toBe('number')
    }
  })
})

describe('GET /api/jobs/facets', () => {
  it('returns facet buckets', async () => {
    const res = await request(app).get('/api/jobs/facets').expect(200)
    expect(res.body.success).toBe(true)
    const f = res.body.data
    expect(Array.isArray(f.categories)).toBe(true)
    expect(Array.isArray(f.seniorities)).toBe(true)
    expect(Array.isArray(f.locations)).toBe(true)
    expect(typeof f.remote.true).toBe('number')
    expect(typeof f.remote.false).toBe('number')
  })
})
