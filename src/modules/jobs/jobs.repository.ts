import { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma'

export class JobsRepository {
  async findMany(params: { where: Prisma.JobWhereInput; take: number; cursor?: string }) {
    const { where, take, cursor } = params
    return prisma.job.findMany({
      where,
      take: take + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { postedDate: 'desc' },
    })
  }

  async count(where: Prisma.JobWhereInput) {
    return prisma.job.count({ where })
  }

  async findById(id: string) {
    return prisma.job.findUnique({
      where: { id },
      include: { screeningQuestions: { orderBy: { order: 'asc' } } },
    })
  }

  async create(data: Prisma.JobCreateInput) {
    return prisma.job.create({
      data,
      include: { screeningQuestions: { orderBy: { order: 'asc' } } },
    })
  }

  async update(id: string, data: Prisma.JobUpdateInput) {
    return prisma.job.update({
      where: { id },
      data,
      include: { screeningQuestions: { orderBy: { order: 'asc' } } },
    })
  }

  async delete(id: string) {
    return prisma.job.delete({ where: { id } })
  }

  async rawList(sql: string, params: unknown[]) {
    return prisma.$queryRawUnsafe<any[]>(sql, ...params)
  }

  async rawCount(sql: string, params: unknown[]) {
    const rows = await prisma.$queryRawUnsafe<[{ count: number }]>(sql, ...params)
    return rows[0]?.count ?? 0
  }
}
