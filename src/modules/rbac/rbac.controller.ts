import type { Request, Response, NextFunction } from 'express'
import { RbacService } from './rbac.service'
import { success, created, noContent } from '../../lib/response'

const rbacService = new RbacService()

export async function listRoles(_req: Request, res: Response, next: NextFunction) {
  try {
    const roles = await rbacService.listRoles()
    success(res, roles)
  } catch (error) {
    next(error)
  }
}

export async function getRoleById(req: Request, res: Response, next: NextFunction) {
  try {
    const role = await rbacService.getRoleById(req.params.id as string)
    success(res, role)
  } catch (error) {
    next(error)
  }
}

export async function createRole(req: Request, res: Response, next: NextFunction) {
  try {
    const role = await rbacService.createRole(req.body)
    created(res, role)
  } catch (error) {
    next(error)
  }
}

export async function updateRole(req: Request, res: Response, next: NextFunction) {
  try {
    const role = await rbacService.updateRole(req.params.id as string, req.body)
    success(res, role)
  } catch (error) {
    next(error)
  }
}

export async function deleteRole(req: Request, res: Response, next: NextFunction) {
  try {
    await rbacService.deleteRole(req.params.id as string)
    noContent(res)
  } catch (error) {
    next(error)
  }
}

export async function createBinding(req: Request, res: Response, next: NextFunction) {
  try {
    const binding = await rbacService.createBinding({
      ...req.body,
      roleId: req.params.id as string,
      grantedBy: req.user!.userId,
    })
    created(res, binding)
  } catch (error) {
    next(error)
  }
}

export async function deleteBinding(req: Request, res: Response, next: NextFunction) {
  try {
    await rbacService.deleteBinding(req.params.bindingId as string)
    noContent(res)
  } catch (error) {
    next(error)
  }
}

export async function listBindings(_req: Request, res: Response, next: NextFunction) {
  try {
    const bindings = await rbacService.listBindings()
    success(res, bindings)
  } catch (error) {
    next(error)
  }
}
