import type { Request, Response, NextFunction } from 'express'
import type { ZodSchema } from 'zod'
import { ValidationError } from './error-handler'

export function validate(schema: ZodSchema, source: 'body' | 'query' | 'params' = 'body') {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source])
    if (!result.success) {
      const messages = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ')
      throw new ValidationError(messages)
    }
    req[source] = result.data
    next()
  }
}
