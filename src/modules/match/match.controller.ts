import type { Request, Response, NextFunction } from 'express'
import { MatchService } from './match.service'
import { success } from '../../lib/response'

const matchService = new MatchService()

export async function match(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await matchService.rankJobs(req.body)
    success(res, result)
  } catch (error) {
    next(error)
  }
}
