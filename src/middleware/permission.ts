import type { Request, Response, NextFunction } from 'express'
import { evaluatePermission } from '../modules/rbac/permission-evaluator'
import { AuthorizationError } from './error-handler'

/**
 * Middleware factory that checks if the authenticated user has the required permission.
 * Must be used after requireAuth.
 *
 * Usage: router.get('/jobs', requireAuth, requirePermission('job:list'), controller.list)
 */
export function requirePermission(action: string) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new AuthorizationError('Authentication required')
    }

    const result = await evaluatePermission(req.user.userId, action)

    if (result.decision === 'DENY') {
      throw new AuthorizationError(`Insufficient permissions: ${result.reason}`)
    }

    next()
  }
}
