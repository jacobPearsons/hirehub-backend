import { prisma } from '../../lib/prisma'

export class BlogRepository {
  async findMany(params: { where: any; take: number; cursor?: string }) {
    const { where, take, cursor } = params
    return prisma.blogPost.findMany({
      where,
      take: take + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { date: 'desc' },
    })
  }

  async count(where: any) {
    return prisma.blogPost.count({ where })
  }

  async findBySlug(slug: string) {
    return prisma.blogPost.findUnique({ where: { slug } })
  }
}
