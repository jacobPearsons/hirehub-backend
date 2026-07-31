import { z } from 'zod'
import { ApplicationsRepository } from './applications.repository'
import { prisma } from '../../lib/prisma'
import { NotFoundError, AuthorizationError, ValidationError } from '../../middleware/error-handler'
import { sendApplicationStatusEmail } from '../../services/email'

export const updateHiringDataSchema = z.object({
  interviewData: z.any().optional().nullable(),
  offerData: z.any().optional().nullable(),
  preboardingData: z.any().optional().nullable(),
  orientationData: z.any().optional().nullable(),
})

export class ApplicationsService {
  private repo = new ApplicationsRepository()

  async create(data: any, userId: string) {
    const { jobId, ...rest } = data
    const job = await prisma.job.findUnique({ where: { id: jobId } })
    if (!job) throw new NotFoundError('Job')
    return this.repo.create({
      ...rest,
      job: { connect: { id: jobId } },
      user: { connect: { id: userId } },
    })
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
      throw new AuthorizationError('You do not own this job')
    }
    const updated = await this.repo.updateStatus(id, status)
    sendApplicationStatusEmail(
      application.applicantEmail,
      application.applicantName,
      application.job.title,
      status,
    ).catch(() => {})
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

    if (userRole === 'EMPLOYER') {
      if (application.job.employerId !== userId) {
        throw new AuthorizationError('Not authorized to update this application')
      }
    } else if (userRole === 'SEEKER') {
      if (application.userId !== userId) {
        throw new AuthorizationError('Not authorized to update this application')
      }
    }

    return this.repo.updateHiringData(applicationId, data)
  }

  async listByEmployer(employerId: string) {
    return this.repo.findByEmployer(employerId)
  }
}
