import { Router } from 'express'
import { validate } from '../../middleware/validate'
import { z } from 'zod'
import * as contactController from './contact.controller'

const router = Router()

const contactSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email'),
  subject: z.string().min(1, 'Subject is required'),
  message: z.string().min(1, 'Message is required'),
})

router.post('/contact', validate(contactSchema), contactController.submit)

export default router
