import type { Request, Response, NextFunction } from 'express'
import { CandidatesService } from './candidates.service'
import { success } from '../../lib/response'

const candidatesService = new CandidatesService()

export async function search(req: Request, res: Response, next: NextFunction) {
  try {
    const { search, page, limit } = req.query
    const result = await candidatesService.searchCandidates({
      search: search as string | undefined,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    })
    success(res, result)
  } catch (error) {
    next(error)
  }
}
