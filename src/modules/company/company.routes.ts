import { Router } from 'express'
import { requireAuth, requireRole } from '../../middleware/auth'
import { validate } from '../../middleware/validate'
import { z } from 'zod'
import * as companyController from './company.controller'

const router = Router()

const companySchema = z.object({
  name: z.string().min(1).max(100),
  logo: z.string().optional(),
  description: z.string().optional(),
  website: z.string().optional(),
  location: z.string().optional(),
  size: z.string().optional(),
  industry: z.string().optional(),
})

router.get('/company', requireAuth, requireRole('EMPLOYER'), companyController.getProfile)
router.put('/company', requireAuth, requireRole('EMPLOYER'), validate(companySchema), companyController.upsertProfile)

export default router
