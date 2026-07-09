import { prisma } from '../../lib/prisma'

export class ApplicationsRepository {
  async create(data: any) {
    return prisma.application.create({ data })
  }

  async findByUser(userId: string) {
    return prisma.application.findMany({
      where: { userId },
      include: { job: true },
      orderBy: { submittedAt: 'desc' },
    })
  }

  async findByJob(jobId: string) {
    return prisma.application.findMany({
      where: { jobId },
      orderBy: { submittedAt: 'desc' },
    })
  }

  async findById(id: string) {
    return prisma.application.findUnique({
      where: { id },
      include: { job: true },
    })
  }

  async updateStatus(id: string, status: string) {
    return prisma.application.update({
      where: { id },
      data: { status: status as any },
    })
  }
}
