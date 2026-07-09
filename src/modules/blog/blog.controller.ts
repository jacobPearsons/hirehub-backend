import type { Request, Response, NextFunction } from 'express'
import { BlogService } from './blog.service'
import { success, paginated } from '../../lib/response'

const blogService = new BlogService()

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await blogService.list(req.query as any)
    paginated(res, result.posts, result.pagination.total, result.pagination.cursor ?? undefined)
  } catch (error) {
    next(error)
  }
}

export async function getBySlug(req: Request, res: Response, next: NextFunction) {
  try {
    const post = await blogService.getBySlug(req.params.slug as string)
    success(res, post)
  } catch (error) {
    next(error)
  }
}
