import { describe, it, expect, beforeAll } from 'vitest'
import { prisma } from '../lib/prisma'
import { ensureSearchIndex } from '../services/search'

describe('search index', () => {
  beforeAll(async () => {
    await ensureSearchIndex()
  })

  it('creates the v2 GIN tsvector index on Job', async () => {
    const rows = await prisma.$queryRaw<{ indexname: string }[]>`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'Job' AND indexname = 'idx_job_search_v2'
    `
    expect(rows.length).toBe(1)
  })
})
