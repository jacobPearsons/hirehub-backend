import { SkillCategory } from '@prisma/client'
import { prisma } from '../../lib/prisma'
import { NotFoundError } from '../../middleware/error-handler'

export class SkillsService {
  async list(category?: string) {
    return prisma.skill.findMany({
      where: category ? { category: category as SkillCategory } : undefined,
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    })
  }

  async facets() {
    const skills = await prisma.skill.groupBy({
      by: ['category'],
      _count: true,
    })
    return Object.fromEntries(skills.map(s => [s.category, s._count]))
  }

  async getBySlug(slug: string) {
    const skill = await prisma.skill.findUnique({ where: { slug } })
    if (!skill) throw new NotFoundError('Skill')
    return skill
  }
}
