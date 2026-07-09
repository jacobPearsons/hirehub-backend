import type { Request, Response, NextFunction } from 'express'
import { SavedJobsService } from './saved-jobs.service'
import { success, created, noContent } from '../../lib/response'

const savedJobsService = new SavedJobsService()

export async function save(req: Request, res: Response, next: NextFunction) {
  try {
    const saved = await savedJobsService.save(req.user!.userId, req.body.jobId)
    created(res, saved)
  } catch (error) {
    next(error)
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    await savedJobsService.remove(req.user!.userId, req.params.jobId as string)
    noContent(res)
  } catch (error) {
    next(error)
  }
}

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const saved = await savedJobsService.list(req.user!.userId)
    success(res, saved)
  } catch (error) {
    next(error)
  }
}
