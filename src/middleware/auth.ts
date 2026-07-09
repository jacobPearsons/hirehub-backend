import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { env } from '../config/env'
import { AuthenticationError, AuthorizationError } from './error-handler'

export interface JwtPayload {
  userId: string
  role: string
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) throw new AuthenticationError()

  try {
    const token = header.slice(7)
    req.user = jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtPayload
    next()
  } catch {
    throw new AuthenticationError('Invalid or expired token')
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      throw new AuthorizationError()
    }
    next()
  }
}
