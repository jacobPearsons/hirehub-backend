import { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma'
import { logger } from '../../config/logger'
import { JobsRepository } from './jobs.repository'
import { NotFoundError, AuthorizationError } from '../../middleware/error-handler'

const EXPIRY_SWEEP_INTERVAL_MS = 24 * 60 * 60 * 1000

let expirySweepTimer: NodeJS.Timeout | undefined

export function startExpirySweep(): NodeJS.Timeout {
  if (expirySweepTimer) return expirySweepTimer
  expirySweepTimer = setInterval(() => {
    logger.info('Job expiry sweep tick: public listing filter is the real enforcement; placeholder no-op')
  }, EXPIRY_SWEEP_INTERVAL_MS)
  expirySweepTimer.unref()
  return expirySweepTimer
}

export class JobsService {
  private repo = new JobsRepository()

  async list(params: {
    category?: string
    seniority?: string
    location?: string
    remote?: string
    search?: string
    cursor?: string
    take?: number
  }) {
    const take = params.take ?? 12

    if (params.search) {
      return this.searchWithTsQuery(params.search, take, params.cursor)
    }

    const where: Prisma.JobWhereInput = { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }
    if (params.category) where.category = params.category
    if (params.seniority) where.seniority = params.seniority
    if (params.location) where.location = { contains: params.location, mode: 'insensitive' }
    if (params.remote === 'true') where.remote = true

    const jobs = await this.repo.findMany({ where, take, cursor: params.cursor })
    const total = await this.repo.count(where)

    const hasMore = jobs.length > take
    const items = hasMore ? jobs.slice(0, take) : jobs
    const nextCursor = hasMore ? items[items.length - 1]?.id : undefined

    return { jobs: items, pagination: { total, cursor: nextCursor ?? null } }
  }

  private async searchWithTsQuery(search: string, take: number, cursor?: string) {
    const jobs = await prisma.$queryRawUnsafe<any[]>(
      `SELECT *,
        ts_rank(
          to_tsvector('english', coalesce(title, '') || ' ' || coalesce(company, '') || ' ' || coalesce(description, '') || ' ' || coalesce(array_to_string(tags, ' '), '')),
          plainto_tsquery('english', $1)
        ) AS rank
       FROM "Job"
       WHERE to_tsvector('english', coalesce(title, '') || ' ' || coalesce(company, '') || ' ' || coalesce(description, '') || ' ' || coalesce(array_to_string(tags, ' '), ''))
         @@ plainto_tsquery('english', $1)
         AND ("expiresAt" IS NULL OR "expiresAt" > (now() AT TIME ZONE 'UTC'))
       ORDER BY rank DESC, "postedDate" DESC
       LIMIT $2`,
      search,
      take + 1,
    )

    const countResult = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
      `SELECT COUNT(*) as count FROM "Job"
       WHERE to_tsvector('english', coalesce(title, '') || ' ' || coalesce(company, '') || ' ' || coalesce(description, '') || ' ' || coalesce(array_to_string(tags, ' '), ''))
         @@ plainto_tsquery('english', $1)
         AND ("expiresAt" IS NULL OR "expiresAt" > (now() AT TIME ZONE 'UTC'))`,
      search,
    )
    const total = Number(countResult[0].count)

    const hasMore = jobs.length > take
    const items = hasMore ? jobs.slice(0, take) : jobs
    const nextCursor = hasMore ? items[items.length - 1]?.id : undefined

    return { jobs: items, pagination: { total, cursor: nextCursor ?? null } }
  }

  async getById(id: string) {
    const job = await this.repo.findById(id)
    if (!job) throw new NotFoundError('Job')
    return job
  }

  async create(data: Omit<Prisma.JobCreateInput, 'employer'>, employerId: string) {
    return this.repo.create({
      ...data,
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      employer: { connect: { id: employerId } },
    })
  }

  async update(id: string, data: Prisma.JobUpdateInput, userId: string) {
    const job = await this.repo.findById(id)
    if (!job) throw new NotFoundError('Job')
    if (job.employerId !== userId) throw new AuthorizationError('You do not own this job')
    return this.repo.update(id, data)
  }

  async delete(id: string, userId: string) {
    const job = await this.repo.findById(id)
    if (!job) throw new NotFoundError('Job')
    if (job.employerId !== userId) throw new AuthorizationError('You do not own this job')
    await this.repo.delete(id)
  }

  async listByEmployer(employerId: string) {
    return this.repo.findMany({ where: { employerId }, take: 100 })
  }
}
