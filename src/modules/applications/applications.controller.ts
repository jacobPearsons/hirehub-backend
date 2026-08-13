import type { Request, Response, NextFunction } from 'express'
import { ApplicationsService, updateHiringDataSchema } from './applications.service'
import { success, created } from '../../lib/response'

const applicationsService = new ApplicationsService()

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const application = await applicationsService.create(req.body, req.user!.userId)
    created(res, application)
  } catch (error) {
    next(error)
  }
}

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const applications = await applicationsService.list(
      req.user!.userId,
      req.user!.role,
      req.query.jobId as string | undefined,
    )
    success(res, applications)
  } catch (error) {
    next(error)
  }
}

export async function updateStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const application = await applicationsService.updateStatus(
      req.params.id as string,
      req.body.status,
      req.user!.userId,
      req.user!.role,
    )
    success(res, application)
  } catch (error) {
    next(error)
  }
}

export async function getCandidate(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await applicationsService.getCandidate(
      req.params.id as string,
      req.user!.userId,
      req.user!.role,
    )
    success(res, data)
  } catch (error) {
    next(error)
  }
}

export async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    const application = await applicationsService.getById(
      req.params.id as string,
      req.user!.userId,
      req.user!.role,
    )
    success(res, application)
  } catch (error) {
    next(error)
  }
}

export async function withdraw(req: Request, res: Response, next: NextFunction) {
  try {
    const application = await applicationsService.withdraw(req.params.id as string, req.user!.userId)
    success(res, application)
  } catch (error) {
    next(error)
  }
}

export async function updateHiringData(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId
    const userRole = String(req.user!.role)
    const applicationId = req.params.id as string
    const data = updateHiringDataSchema.parse(req.body)
    const application = await applicationsService.updateHiringData(userId, applicationId, data, userRole)
    success(res, application)
  } catch (error) {
    next(error)
  }
}

export async function listByEmployer(req: Request, res: Response, next: NextFunction) {
  try {
    const applications = await applicationsService.listByEmployer(req.user!.userId)
    success(res, applications)
  } catch (error) {
    next(error)
  }
}

export async function openInterviewConversation(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await applicationsService.openInterviewConversation(req.params.id as string, req.user!.userId)
    res.status(201).json({ success: true, data })
  } catch (error) {
    next(error)
  }
}
