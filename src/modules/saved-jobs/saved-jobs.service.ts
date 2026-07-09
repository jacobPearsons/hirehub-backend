import { prisma } from '../../lib/prisma'
import { NotFoundError } from '../../middleware/error-handler'

export class SavedJobsService {
  async save(userId: string, jobId: string) {
    const job = await prisma.job.findUnique({ where: { id: jobId } })
    if (!job) throw new NotFoundError('Job')
    const saved = await prisma.savedJob.upsert({
      where: { userId_jobId: { userId, jobId } },
      create: { userId, jobId },
      update: {},
      include: { job: true },
    })
    return saved
  }

  async remove(userId: string, jobId: string) {
    await prisma.savedJob.deleteMany({ where: { userId, jobId } })
  }

  async list(userId: string) {
    return prisma.savedJob.findMany({
      where: { userId },
      include: { job: true },
      orderBy: { id: 'desc' },
    })
  }
}
