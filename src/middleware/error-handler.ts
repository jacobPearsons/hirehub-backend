import type { Request, Response, NextFunction } from 'express'
import { Prisma } from '@prisma/client'
import { logger } from '../config/logger'

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message)
    this.name = this.constructor.name
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(400, message)
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication required') {
    super(401, message)
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'Insufficient permissions') {
    super(403, message)
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(404, `${resource} not found`)
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, message)
  }
}

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ success: false, error: err.message })
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002':
        return res.status(409).json({ success: false, error: 'A record with this value already exists' })
      case 'P2025':
        return res.status(404).json({ success: false, error: 'Record not found' })
      case 'P2003':
        return res.status(400).json({ success: false, error: 'Referenced record does not exist' })
      default:
        logger.error({ err }, `Prisma error ${err.code}`)
        return res.status(500).json({ success: false, error: 'Database error' })
    }
  }

  logger.error({ err }, 'Unhandled error')
  return res.status(500).json({ success: false, error: 'Internal server error' })
}
