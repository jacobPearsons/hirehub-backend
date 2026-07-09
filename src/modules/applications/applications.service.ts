import { ApplicationsRepository } from './applications.repository'
import { prisma } from '../../lib/prisma'
import { NotFoundError, AuthorizationError, ValidationError } from '../../middleware/error-handler'
import { sendApplicationStatusEmail } from '../../services/email'

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

  async updateStatus(id: string, status: string, userId: string) {
    const application = await this.repo.findById(id)
    if (!application) throw new NotFoundError('Application')
    if (application.job.employerId !== userId) throw new AuthorizationError('You do not own this job')
    const updated = await this.repo.updateStatus(id, status)
    sendApplicationStatusEmail(
      application.applicantEmail,
      application.applicantName,
      application.job.title,
      status,
    ).catch(() => {})
    return updated
  }
}
