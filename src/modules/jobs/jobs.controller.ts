import type { Request, Response, NextFunction } from 'express'
import { JobsService } from './jobs.service'
import { success, paginated, created, noContent } from '../../lib/response'

const jobsService = new JobsService()

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const { category, seniority, location, remote, search, cursor, take } = req.query
    const result = await jobsService.list({
      category: category as string | undefined,
      seniority: seniority as string | undefined,
      location: location as string | undefined,
      remote: remote as string | undefined,
      search: search as string | undefined,
      cursor: cursor as string | undefined,
      take: take ? Number(take) : undefined,
    })
    paginated(res, result.jobs, result.pagination.total, result.pagination.cursor ?? undefined)
  } catch (error) {
    next(error)
  }
}

export async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    const job = await jobsService.getById(req.params.id as string)
    success(res, job)
  } catch (error) {
    next(error)
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const job = await jobsService.create(req.body, req.user!.userId)
    created(res, job)
  } catch (error) {
    next(error)
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const job = await jobsService.update(req.params.id as string, req.body, req.user!.userId)
    success(res, job)
  } catch (error) {
    next(error)
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    await jobsService.delete(req.params.id as string, req.user!.userId)
    noContent(res)
  } catch (error) {
    next(error)
  }
}

export async function listByEmployer(req: Request, res: Response, next: NextFunction) {
  try {
    const jobs = await jobsService.listByEmployer(req.user!.userId)
    success(res, jobs)
  } catch (error) {
    next(error)
  }
}
