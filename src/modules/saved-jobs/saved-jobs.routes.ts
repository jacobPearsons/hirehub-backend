import { Router } from 'express'
import { requireAuth, requireRole } from '../../middleware/auth'
import { validate } from '../../middleware/validate'
import { z } from 'zod'
import * as savedJobsController from './saved-jobs.controller'

const router = Router()

const saveJobSchema = z.object({
  jobId: z.string().min(1),
})

router.post('/saved-jobs', requireAuth, requireRole('SEEKER'), validate(saveJobSchema), savedJobsController.save)
router.delete('/saved-jobs/:jobId', requireAuth, requireRole('SEEKER'), savedJobsController.remove)
router.get('/saved-jobs', requireAuth, requireRole('SEEKER'), savedJobsController.list)

export default router
