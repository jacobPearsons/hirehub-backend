import { Prisma, ApplicationStatus, UserRole } from '@prisma/client'
import { prisma } from '../../lib/prisma'

export class ApplicationsRepository {
  async create(data: Prisma.ApplicationCreateInput) {
    return prisma.application.create({
      data,
      include: {
        screeningAnswers: { include: { question: true } },
        screeningResult: true,
        timeline: { orderBy: { createdAt: 'asc' } },
      },
    })
  }

  async findByUser(userId: string) {
    return prisma.application.findMany({
      where: { userId },
      include: {
        job: true,
        screeningAnswers: { include: { question: true } },
        screeningResult: true,
        timeline: { orderBy: { createdAt: 'asc' } },
      },
      orderBy: { submittedAt: 'desc' },
    })
  }

  async findByJob(jobId: string) {
    return prisma.application.findMany({
      where: { jobId },
      include: {
        screeningAnswers: { include: { question: true } },
        screeningResult: true,
        timeline: { orderBy: { createdAt: 'asc' } },
      },
      orderBy: { submittedAt: 'desc' },
    })
  }

  async findById(id: string) {
    return prisma.application.findUnique({
      where: { id },
      include: {
        job: true,
        screeningAnswers: { include: { question: true } },
        screeningResult: true,
        timeline: { orderBy: { createdAt: 'asc' } },
      },
    })
  }

  async updateStatus(id: string, status: string, tx?: Prisma.TransactionClient) {
    const client = tx ?? prisma
    return client.application.update({
      where: { id },
      data: { status: status as ApplicationStatus },
    })
  }

  async createTimelineEntry(data: {
    applicationId: string
    fromStatus?: ApplicationStatus
    toStatus: ApplicationStatus
    actorRole: UserRole
    changedByUserId?: string
  }, tx?: Prisma.TransactionClient) {
    const client = tx ?? prisma
    return client.applicationTimelineEntry.create({ data })
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
      include: {
        job: true,
        screeningAnswers: { include: { question: true } },
        screeningResult: true,
        timeline: { orderBy: { createdAt: 'asc' } },
      },
      orderBy: { submittedAt: 'desc' },
    })
  }
}
