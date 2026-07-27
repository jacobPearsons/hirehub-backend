import type { Request, Response, NextFunction } from 'express'
import { AuditService } from './audit.service'
import { paginated } from '../../lib/response'

const auditService = new AuditService()

export async function listEvents(req: Request, res: Response, next: NextFunction) {
  try {
    const { actorId, action, resource, resourceId, from, to, cursor, take } = req.query
    const result = await auditService.query({
      actorId: actorId as string | undefined,
      action: action as string | undefined,
      resource: resource as string | undefined,
      resourceId: resourceId as string | undefined,
      from: from as string | undefined,
      to: to as string | undefined,
      cursor: cursor as string | undefined,
      take: take ? Number(take) : undefined,
    })
    paginated(res, result.events, result.total, result.cursor ?? undefined)
  } catch (error) {
    next(error)
  }
}
