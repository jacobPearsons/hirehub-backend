import type { Request, Response, NextFunction } from 'express'
import { PricingService } from './pricing.service'
import { success } from '../../lib/response'

const pricingService = new PricingService()

export async function getAll(req: Request, res: Response, next: NextFunction) {
  try {
    const tiers = await pricingService.getAll()
    success(res, tiers)
  } catch (error) {
    next(error)
  }
}
