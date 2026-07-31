import { prisma } from '../../lib/prisma'

export class CompanyService {
  async getMyCompany(userId: string) {
    return prisma.company.findUnique({ where: { employerId: userId } })
  }

  async upsertCompany(userId: string, data: { name: string; logo?: string; description?: string; website?: string; location?: string; size?: string; industry?: string }) {
    return prisma.company.upsert({
      where: { employerId: userId },
      create: { ...data, employer: { connect: { id: userId } } },
      update: data,
    })
  }

  async uploadLogo(userId: string, filename: string) {
    return prisma.company.update({
      where: { employerId: userId },
      data: { logo: `/company-logos/${filename}` },
    })
  }
}
