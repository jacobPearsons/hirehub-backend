import { Router } from 'express'
import { requireAuth, requireRole } from '../../middleware/auth'
import { validate } from '../../middleware/validate'
import { z } from 'zod'
import * as applicationsController from './applications.controller'
import { updateHiringDataSchema } from './applications.service'

const router = Router()

const createApplicationSchema = z.object({
  jobId: z.string().min(1),
  applicantName: z.string().min(1).max(100),
  applicantEmail: z.string().email(),
  applicantPhone: z.string().optional(),
  coverLetter: z.string().min(1).max(50000),
  portfolioUrl: z.string().url().optional(),
  resumePath: z.string().optional(),
  resumeFileName: z.string().optional(),
})

const updateStatusSchema = z.object({
  status: z.enum(['APPLIED', 'REVIEWING', 'INTERVIEWING', 'REJECTED', 'OFFER']),
})

router.post('/applications', requireAuth, requireRole('SEEKER'), validate(createApplicationSchema), applicationsController.create)
router.get('/applications', requireAuth, applicationsController.list)
router.get('/applications/employer/me', requireAuth, requireRole('EMPLOYER'), applicationsController.listByEmployer)
router.get('/applications/:id/candidate', requireAuth, requireRole('EMPLOYER', 'ADMIN'), applicationsController.getCandidate)
router.patch('/applications/:id/status', requireAuth, requireRole('EMPLOYER', 'ADMIN'), validate(updateStatusSchema), applicationsController.updateStatus)
router.patch('/applications/:id/hiring-data', requireAuth, validate(updateHiringDataSchema), applicationsController.updateHiringData)

export default router
