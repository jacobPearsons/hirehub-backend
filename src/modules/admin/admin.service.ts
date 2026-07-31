import type { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma'
import { NotFoundError } from '../../middleware/error-handler'

const userSelect = { id: true, name: true, email: true, role: true, companyName: true, createdAt: true } as const

export class AdminService {
  async listUsers() {
    return prisma.user.findMany({
      select: userSelect,
      orderBy: { createdAt: 'desc' },
    })
  }

  async updateUserRole(id: string, role: Prisma.UserUpdateInput['role']) {
    const user = await prisma.user.findUnique({ where: { id } })
    if (!user) throw new NotFoundError('User')

    return prisma.user.update({
      where: { id },
      data: { role },
      select: userSelect,
    })
  }

  async listJobs() {
    return prisma.job.findMany({
      include: { employer: { select: { id: true, name: true, email: true } } },
      orderBy: { postedDate: 'desc' },
    })
  }

  async listApplications() {
    return prisma.application.findMany({
      include: { job: true },
      orderBy: { submittedAt: 'desc' },
    })
  }

  async listEmployers() {
    return prisma.user.findMany({
      where: { role: 'EMPLOYER' },
      select: {
        id: true,
        name: true,
        email: true,
        companyName: true,
        avatarUrl: true,
        location: true,
        createdAt: true,
        _count: { select: { jobListings: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  async deleteJob(id: string) {
    const job = await prisma.job.findUnique({ where: { id } })
    if (!job) throw new NotFoundError('Job')
    await prisma.job.delete({ where: { id } })
  }

  async listBlogPosts() {
    return prisma.blogPost.findMany({ orderBy: { date: 'desc' } })
  }

  async deleteBlogPost(id: string) {
    const post = await prisma.blogPost.findUnique({ where: { id } })
    if (!post) throw new NotFoundError('Blog post')
    await prisma.blogPost.delete({ where: { id } })
  }
}
