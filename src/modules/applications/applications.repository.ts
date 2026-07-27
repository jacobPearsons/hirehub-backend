import { Prisma, ApplicationStatus } from '@prisma/client'
import { prisma } from '../../lib/prisma'

export class ApplicationsRepository {
  async create(data: Prisma.ApplicationCreateInput) {
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
      data: { status: status as ApplicationStatus },
    })
  }

  async updateHiringData(id: string, data: {
    interviewData?: Prisma.InputJsonValue
    offerData?: Prisma.InputJsonValue
    preboardingData?: Prisma.InputJsonValue
    orientationData?: Prisma.InputJsonValue
  }) {
    return prisma.application.update({
      where: { id },
      data,
      include: { job: true },
    })
  }

  async findByEmployer(employerId: string) {
    return prisma.application.findMany({
      where: { job: { employerId } },
      include: { job: true },
      orderBy: { submittedAt: 'desc' },
    })
  }
}
