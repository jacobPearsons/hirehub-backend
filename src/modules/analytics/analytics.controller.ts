import type { Request, Response, NextFunction } from 'express'
import { AnalyticsService } from './analytics.service'
import { success } from '../../lib/response'

const analyticsService = new AnalyticsService()

export async function getEmployerDashboard(req: Request, res: Response, next: NextFunction) {
  try {
    const dashboard = await analyticsService.getEmployerDashboard(req.user!.userId)
    success(res, dashboard)
  } catch (error) {
    next(error)
  }
}
