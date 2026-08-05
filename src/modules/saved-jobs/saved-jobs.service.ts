import { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma'
import { NotFoundError, ConflictError } from '../../middleware/error-handler'

export class SavedJobsService {
  async save(userId: string, jobId: string) {
    const job = await prisma.job.findUnique({ where: { id: jobId } })
    if (!job) throw new NotFoundError('Job')
    try {
      return await prisma.savedJob.create({
        data: { userId, jobId },
        include: { job: true },
      })
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictError('Job already saved')
      }
      throw err
    }
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
