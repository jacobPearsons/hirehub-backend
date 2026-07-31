import type { Request, Response, NextFunction } from 'express'
import { CompanyService } from './company.service'
import { success, created } from '../../lib/response'
import { ValidationError } from '../../middleware/error-handler'

const companyService = new CompanyService()

export async function getProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const company = await companyService.getMyCompany(req.user!.userId)
    success(res, company)
  } catch (error) {
    next(error)
  }
}

export async function upsertProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const company = await companyService.upsertCompany(req.user!.userId, req.body)
    created(res, company)
  } catch (error) {
    next(error)
  }
}

export async function uploadLogo(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file) {
      throw new ValidationError('No file uploaded')
    }
    const company = await companyService.uploadLogo(req.user!.userId, req.file.filename)
    success(res, { logoUrl: company.logo })
  } catch (error) {
    next(error)
  }
}
