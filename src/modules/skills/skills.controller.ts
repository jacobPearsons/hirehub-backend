import type { Request, Response, NextFunction } from 'express'
import { SkillsService } from './skills.service'
import { success } from '../../lib/response'

const skillsService = new SkillsService()

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const category = typeof req.query.category === 'string' ? req.query.category : undefined
    const skills = await skillsService.list(category)
    success(res, skills)
  } catch (error) {
    next(error)
  }
}

export async function facets(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await skillsService.facets()
    success(res, result)
  } catch (error) {
    next(error)
  }
}

export async function getBySlug(req: Request, res: Response, next: NextFunction) {
  try {
    const skill = await skillsService.getBySlug(req.params.slug as string)
    success(res, skill)
  } catch (error) {
    next(error)
  }
}
