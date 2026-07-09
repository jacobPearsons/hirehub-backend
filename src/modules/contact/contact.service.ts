import { prisma } from '../../lib/prisma'

export class ContactService {
  async submit(data: { name: string; email: string; subject: string; message: string }) {
    return prisma.contactSubmission.create({ data })
  }
}
