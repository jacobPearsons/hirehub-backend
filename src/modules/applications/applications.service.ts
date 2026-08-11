import { z } from 'zod'
import { ApplicationStatus, UserRole } from '@prisma/client'
import { ApplicationsRepository } from './applications.repository'
import { prisma } from '../../lib/prisma'
import { NotFoundError, AuthorizationError, ValidationError } from '../../middleware/error-handler'
import { sendApplicationStatusEmail, sendInterviewInviteEmail } from '../../services/email'
import { sendToUser } from '../../services/sse'
import { notificationsService } from '../notifications/notifications.service'
import { evaluatePermission } from '../rbac/permission-evaluator'
import { scoreApplication, type ScreeningAnswerInput, type ScreeningScore } from '../screening/screeningEngine'
import { canTransition } from './status-transitions'

export const updateHiringDataSchema = z.object({
  interviewData: z.any().optional().nullable(),
  offerData: z.any().optional().nullable(),
  preboardingData: z.any().optional().nullable(),
  orientationData: z.any().optional().nullable(),
})

export class ApplicationsService {
  private repo = new ApplicationsRepository()

  async create(data: any, userId: string) {
    const { jobId, screeningAnswers, ...rest } = data
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: { screeningQuestions: { orderBy: { order: 'asc' } } },
    })
    if (!job) throw new NotFoundError('Job')

    let screening: ScreeningScore | null = null
    let answersCreate: { questionId: string; answerText: string; score: number; matchedKeywords: string[] }[] | undefined

    if (job.screeningQuestions.length > 0) {
      const answers = (screeningAnswers ?? []) as ScreeningAnswerInput[]
      const validIds = new Set(job.screeningQuestions.map((q) => q.id))
      for (const answer of answers) {
        if (!validIds.has(answer.questionId)) {
          throw new ValidationError('screeningAnswers contains a question that does not belong to this job')
        }
      }
      screening = scoreApplication({
        requirements: job.requirements,
        tags: job.tags,
        coverLetter: rest.coverLetter,
        questions: job.screeningQuestions.map((q) => ({
          id: q.id,
          prompt: q.prompt,
          expectedKeywords: q.expectedKeywords,
          maxScore: q.maxScore,
        })),
        answers,
      })
      const byQuestion = new Map(answers.map((a) => [a.questionId, a.answerText]))
      answersCreate = screening.answers.map((a) => ({
        questionId: a.questionId,
        answerText: byQuestion.get(a.questionId) ?? '',
        score: a.score,
        matchedKeywords: a.matchedKeywords,
      }))
    }

    const application = await this.repo.create({
      ...rest,
      job: { connect: { id: jobId } },
      user: { connect: { id: userId } },
      timeline: { create: { toStatus: ApplicationStatus.APPLIED, actorRole: UserRole.SEEKER } },
      ...(screening && answersCreate
        ? {
            screeningResult: { create: { score: screening.score, maxPossible: screening.maxPossible } },
            screeningAnswers: { create: answersCreate },
          }
        : {}),
    })

    sendToUser(job.employerId, 'application:updated', { applicationId: application.id, jobId, status: 'APPLIED' })

    return application
  }

  async list(userId: string, role: string, jobId?: string) {
    if (role === 'SEEKER') {
      return this.repo.findByUser(userId)
    }
    if (role === 'EMPLOYER') {
      if (!jobId) throw new ValidationError('jobId query parameter is required for employers')
      const job = await prisma.job.findUnique({ where: { id: jobId } })
      if (!job) throw new NotFoundError('Job')
      if (job.employerId !== userId) throw new AuthorizationError('You do not own this job')
      return this.repo.findByJob(jobId)
    }
    throw new AuthorizationError()
  }

  async updateStatus(id: string, status: string, userId: string, userRole: string) {
    const application = await this.repo.findById(id)
    if (!application) throw new NotFoundError('Application')
    if (userRole !== 'ADMIN' && application.job.employerId !== userId) {
      throw new AuthorizationError('Not authorized to update this application')
    }
    const nextStatus = status as ApplicationStatus
    if (nextStatus === ApplicationStatus.WITHDRAWN) {
      throw new ValidationError('Use the withdraw endpoint for candidate withdrawals')
    }
    if (!canTransition(application.status, nextStatus)) {
      throw new ValidationError(`Cannot move an application from ${application.status} to ${nextStatus}`)
    }
    const updated = await prisma.$transaction(async (tx) => {
      const app = await this.repo.updateStatus(id, nextStatus, tx)
      await this.repo.createTimelineEntry({
        applicationId: application.id,
        fromStatus: application.status,
        toStatus: nextStatus,
        actorRole: userRole === 'ADMIN' ? UserRole.ADMIN : UserRole.EMPLOYER,
        changedByUserId: userId,
      }, tx)
      return app
    })
    if (nextStatus === 'INTERVIEWING') {
      sendInterviewInviteEmail(
        application.applicantEmail,
        application.applicantName,
        application.job.title,
        application.job.company,
        application.interviewData,
      ).catch(() => {})
    } else {
      sendApplicationStatusEmail(
        application.applicantEmail,
        application.applicantName,
        application.job.title,
        application.job.company,
        nextStatus,
      ).catch(() => {})
    }
    notificationsService.createForUser(application.userId, {
      type: 'APPLICATION_STATUS',
      title: 'Application status updated',
      body: `Your application for ${application.job.title} is now ${nextStatus}.`,
      data: { applicationId: application.id, jobId: application.jobId, status: nextStatus },
    }).catch(() => {})
    sendToUser(application.job.employerId, 'application:updated', { applicationId: application.id, jobId: application.jobId, status: nextStatus })
    return updated
  }

  async getCandidate(applicationId: string, userId: string, userRole: string) {
    const application = await this.repo.findById(applicationId)
    if (!application) throw new NotFoundError('Application')
    if (userRole !== 'ADMIN' && application.job.employerId !== userId) {
      throw new AuthorizationError('Not authorized to view this candidate')
    }
    const candidate = await prisma.user.findUnique({
      where: { id: application.userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        avatarUrl: true,
        headline: true,
        location: true,
        skills: true,
        bio: true,
        resumePath: true,
        resumeFileName: true,
        salaryMin: true,
        salaryMax: true,
        currency: true,
        remoteOnly: true,
        employmentType: true,
        onboardingCompleted: true,
        createdAt: true,
      },
    })
    if (!candidate) throw new NotFoundError('Candidate')
    return { application, candidate }
  }

  async updateHiringData(userId: string, applicationId: string, data: z.infer<typeof updateHiringDataSchema>, userRole: string) {
    const application = await this.repo.findById(applicationId)
    if (!application) throw new NotFoundError('Application')

    if (userRole === 'SEEKER') {
      if (application.userId !== userId) {
        throw new AuthorizationError('Not authorized to update this application')
      }
    } else if (userRole === 'EMPLOYER') {
      const result = await evaluatePermission(userId, 'application:update')
      if (result.decision === 'DENY' || application.job.employerId !== userId) {
        throw new AuthorizationError('Not authorized to update this application')
      }
    } else if (userRole !== 'ADMIN') {
      throw new AuthorizationError('Not authorized to update this application')
    }

    return this.repo.updateHiringData(applicationId, data)
  }

  async getById(id: string, userId: string, userRole: string) {
    const application = await this.repo.findById(id)
    if (!application) throw new NotFoundError('Application')
    if (userRole === 'ADMIN') return application
    if (userRole === 'SEEKER') {
      if (application.userId !== userId) {
        throw new AuthorizationError('Not authorized to view this application')
      }
      return application
    }
    if (application.job.employerId !== userId) {
      throw new AuthorizationError('Not authorized to view this application')
    }
    return application
  }

  async withdraw(id: string, userId: string) {
    const application = await this.repo.findById(id)
    if (!application) throw new NotFoundError('Application')
    if (application.userId !== userId) {
      throw new AuthorizationError('You cannot withdraw this application')
    }
    if (!canTransition(application.status, ApplicationStatus.WITHDRAWN)) {
      throw new ValidationError('This application can no longer be withdrawn')
    }
    const updated = await prisma.$transaction(async (tx) => {
      const app = await this.repo.updateStatus(id, ApplicationStatus.WITHDRAWN, tx)
      await this.repo.createTimelineEntry({
        applicationId: application.id,
        fromStatus: application.status,
        toStatus: ApplicationStatus.WITHDRAWN,
        actorRole: UserRole.SEEKER,
        changedByUserId: userId,
      }, tx)
      return app
    })
    sendToUser(application.job.employerId, 'application:updated', { applicationId: application.id, jobId: application.jobId, status: 'WITHDRAWN' })
    return updated
  }

  async listByEmployer(employerId: string) {
    return this.repo.findByEmployer(employerId)
  }
}
