import { z } from 'zod'

export const listJobsQuerySchema = z.object({
  search: z.string().max(200).optional(),
  location: z.string().max(100).optional(),
  category: z.string().max(100).optional(),
  seniority: z.string().max(50).optional(),
  remote: z.enum(['true', 'false']).optional(),
  salaryMin: z.coerce.number().int().min(0).optional(),
  salaryMax: z.coerce.number().int().min(0).optional(),
  featured: z.enum(['true', 'false']).optional(),
  sort: z.enum(['relevance', 'recent', 'salary_high', 'salary_low', 'remote_first']).default('recent'),
  cursor: z.string().max(500).optional(),
  take: z.coerce.number().int().min(1).max(100).default(12).catch(100),
})

export type ListJobsQuery = z.infer<typeof listJobsQuerySchema>
export type JobSort = NonNullable<ListJobsQuery['sort']>

export function encodeCursor(values: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(values)).toString('base64url')
}

export function decodeCursor(cursor?: string): Record<string, unknown> | null {
  if (!cursor) return null
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'))
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}
