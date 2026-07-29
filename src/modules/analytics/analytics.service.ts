import { prisma } from '../../lib/prisma'

export class AnalyticsService {
  async getEmployerDashboard(employerId: string) {
    const [totalJobs, totalApplications, applicationsByStatus, recentApplications] = await Promise.all([
      prisma.job.count({ where: { employerId } }),
      prisma.application.count({ where: { job: { employerId } } }),
      prisma.application.groupBy({
        by: ['status'],
        where: { job: { employerId } },
        _count: true,
      }),
      prisma.application.findMany({
        where: { job: { employerId } },
        orderBy: { submittedAt: 'desc' },
        take: 10,
        include: {
          job: { select: { id: true, title: true } },
          user: { select: { id: true, name: true, avatarUrl: true } },
        },
      }),
    ])

    return { totalJobs, totalApplications, applicationsByStatus, recentApplications }
  }
}
