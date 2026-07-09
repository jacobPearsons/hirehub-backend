import { Router } from 'express'
import { requireAuth, requireRole } from '../../middleware/auth'
import { validate } from '../../middleware/validate'
import { z } from 'zod'
import * as applicationsController from './applications.controller'

const router = Router()

const createApplicationSchema = z.object({
  jobId: z.string().min(1),
  applicantName: z.string().min(1),
  applicantEmail: z.string().email(),
  applicantPhone: z.string().optional(),
  coverLetter: z.string().min(1),
  portfolioUrl: z.string().url().optional(),
  resumePath: z.string().optional(),
  resumeFileName: z.string().optional(),
})

const updateStatusSchema = z.object({
  status: z.enum(['APPLIED', 'REVIEWING', 'INTERVIEWING', 'REJECTED', 'OFFER']),
})

router.post('/applications', requireAuth, requireRole('SEEKER'), validate(createApplicationSchema), applicationsController.create)
router.get('/applications', requireAuth, applicationsController.list)
router.patch('/applications/:id/status', requireAuth, requireRole('EMPLOYER'), validate(updateStatusSchema), applicationsController.updateStatus)

export default router
