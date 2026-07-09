import { prisma } from '../../lib/prisma'

export class JobsRepository {
  async findMany(params: { where: any; take: number; cursor?: string }) {
    const { where, take, cursor } = params
    return prisma.job.findMany({
      where,
      take: take + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { postedDate: 'desc' },
    })
  }

  async count(where: any) {
    return prisma.job.count({ where })
  }

  async findById(id: string) {
    return prisma.job.findUnique({ where: { id } })
  }

  async create(data: any) {
    return prisma.job.create({ data })
  }

  async update(id: string, data: any) {
    return prisma.job.update({ where: { id }, data })
  }

  async delete(id: string) {
    return prisma.job.delete({ where: { id } })
  }
}
