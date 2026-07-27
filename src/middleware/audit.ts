import type { Request, Response, NextFunction } from 'express'
import { auditService } from '../modules/audit/audit.service'

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

const METHOD_TO_ACTION: Record<string, string> = {
  POST: 'create',
  PUT: 'update',
  PATCH: 'update',
  DELETE: 'delete',
}

export function auditLog(req: Request, res: Response, next: NextFunction) {
  if (!MUTATING_METHODS.has(req.method)) {
    return next()
  }

  res.on('finish', () => {
    const action = METHOD_TO_ACTION[req.method] ?? req.method.toLowerCase()

    const pathParts = req.path.split('/').filter(Boolean)
    const resource = pathParts[1] ?? 'unknown'
    const resourceId = pathParts[2] ?? undefined

    auditService.logEvent({
      actorId: req.user?.userId,
      action: `${resource}:${action}`,
      resource,
      resourceId,
      metadata: {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
      },
      ipAddress: req.ip,
    })
  })

  next()
}
