import { prisma } from '../../lib/prisma'
import { JobsRepository } from './jobs.repository'
import { NotFoundError, AuthorizationError } from '../../middleware/error-handler'

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

    const where: any = {}
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
       ORDER BY rank DESC, "postedDate" DESC
       LIMIT $2`,
      search,
      take + 1,
    )

    const countResult = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
      `SELECT COUNT(*) as count FROM "Job"
       WHERE to_tsvector('english', coalesce(title, '') || ' ' || coalesce(company, '') || ' ' || coalesce(description, '') || ' ' || coalesce(array_to_string(tags, ' '), ''))
         @@ plainto_tsquery('english', $1)`,
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

  async create(data: any, employerId: string) {
    return this.repo.create({
      ...data,
      employer: { connect: { id: employerId } },
    })
  }

  async update(id: string, data: any, userId: string) {
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
}
