import type { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma'

export class CandidatesService {
  async searchCandidates(params: { search?: string; page?: number; limit?: number }) {
    const page = params.page ?? 1
    const limit = Math.min(params.limit ?? 20, 100)
    const skip = (page - 1) * limit

    const where: Prisma.UserWhereInput = { role: 'SEEKER' }
    if (params.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { bio: { contains: params.search, mode: 'insensitive' } },
      ]
    }

    const [candidates, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: { id: true, name: true, email: true, bio: true, avatarUrl: true, companyName: true, createdAt: true },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ])

    return {
      candidates,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    }
  }
}
