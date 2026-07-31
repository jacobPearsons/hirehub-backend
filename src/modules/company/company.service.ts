import { prisma } from '../../lib/prisma'
import { AppError } from '../../middleware/error-handler'

export class CompanyService {
  async getMyCompany(userId: string) {
    return prisma.company.findUnique({ where: { employerId: userId } })
  }

  async inviteTeam(userId: string, emails: string[]) {
    const company = await this.getMyCompany(userId)
    if (!company) throw new AppError(404, 'Company not found')

    const uniqueEmails = [...new Set(emails.map((email) => email.toLowerCase()))]
    await prisma.companyInvite.createMany({
      data: uniqueEmails.map((email) => ({ companyId: company.id, email })),
      skipDuplicates: true,
    })
    return prisma.companyInvite.findMany({
      where: { companyId: company.id },
      orderBy: { createdAt: 'desc' },
    })
  }

  async getInvites(userId: string) {
    const company = await this.getMyCompany(userId)
    if (!company) throw new AppError(404, 'Company not found')

    return prisma.companyInvite.findMany({
      where: { companyId: company.id },
      orderBy: { createdAt: 'desc' },
    })
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
