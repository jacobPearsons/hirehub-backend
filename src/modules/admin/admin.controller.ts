import type { Request, Response } from 'express'
import { prisma } from '../../lib/prisma'
import { success } from '../../lib/response'
import { NotFoundError } from '../../middleware/error-handler'

export async function listUsers(req: Request, res: Response) {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, companyName: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  })
  success(res, users)
}

export async function updateUserRole(req: Request, res: Response) {
  const { id } = req.params as { id: string }
  const { role } = req.body

  const user = await prisma.user.findUnique({ where: { id } })
  if (!user) throw new NotFoundError('User')

  const updated = await prisma.user.update({
    where: { id },
    data: { role },
    select: { id: true, name: true, email: true, role: true, companyName: true, createdAt: true },
  })
  success(res, updated)
}

export async function listJobs(req: Request, res: Response) {
  const jobs = await prisma.job.findMany({
    include: { employer: { select: { id: true, name: true, email: true } } },
    orderBy: { postedDate: 'desc' },
  })
  success(res, jobs)
}

export async function deleteJob(req: Request, res: Response) {
  const { id } = req.params as { id: string }
  const job = await prisma.job.findUnique({ where: { id } })
  if (!job) throw new NotFoundError('Job')
  await prisma.job.delete({ where: { id } })
  success(res, { message: 'Job deleted' })
}

export async function listBlogPosts(req: Request, res: Response) {
  const posts = await prisma.blogPost.findMany({ orderBy: { date: 'desc' } })
  success(res, posts)
}

export async function deleteBlogPost(req: Request, res: Response) {
  const { id } = req.params as { id: string }
  const post = await prisma.blogPost.findUnique({ where: { id } })
  if (!post) throw new NotFoundError('Blog post')
  await prisma.blogPost.delete({ where: { id } })
  success(res, { message: 'Blog post deleted' })
}
