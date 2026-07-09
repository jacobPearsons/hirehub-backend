import { prisma } from '../../lib/prisma'

export class PricingService {
  async getAll() {
    return prisma.pricingTier.findMany({ orderBy: { price: 'asc' } })
  }
}
