import { prisma } from '../lib/prisma'

export async function ensureSearchIndex() {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_job_search
      ON "Job"
      USING GIN (
        to_tsvector('english', coalesce(title, '') || ' ' || coalesce(company, '') || ' ' || coalesce(description, '') || ' ' || coalesce(array_to_string(tags, ' '), ''))
      )
    `)
  } catch {
    try {
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS idx_job_search
        ON "Job"
        USING GIN (
          to_tsvector('english', coalesce(title, '') || ' ' || coalesce(company, '') || ' ' || coalesce(description, '') || ' ' || coalesce(array_to_string(tags, ' '), ''))
        )
      `)
    } catch {
      // Index already exists or table is empty — non-critical
    }
  }
}
