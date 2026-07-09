import type { Request, Response, NextFunction } from 'express'
import { ContactService } from './contact.service'
import { created } from '../../lib/response'

const contactService = new ContactService()

export async function submit(req: Request, res: Response, next: NextFunction) {
  try {
    const submission = await contactService.submit(req.body)
    created(res, submission)
  } catch (error) {
    next(error)
  }
}
