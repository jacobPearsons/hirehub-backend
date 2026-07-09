import type { Request, Response, NextFunction } from 'express'
import crypto from 'node:crypto'

export function requestId(req: Request, _res: Response, next: NextFunction) {
  req.id = crypto.randomUUID()
  next()
}

declare global {
  namespace Express {
    interface Request {
      id: string
    }
  }
}
