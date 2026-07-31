import { Router } from 'express'
import { requireAuth, requireRole } from '../../middleware/auth'
import { validate } from '../../middleware/validate'
import { uploadLogo } from '../../services/upload'
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

const invitesSchema = z.object({
  emails: z.array(z.string().email()).min(1).max(20),
})

router.get('/company', requireAuth, requireRole('EMPLOYER'), companyController.getProfile)
router.put('/company', requireAuth, requireRole('EMPLOYER'), validate(companySchema), companyController.upsertProfile)
router.post('/company/logo', requireAuth, requireRole('EMPLOYER'), uploadLogo.single('logo'), companyController.uploadLogo)
router.post('/company/invites', requireAuth, requireRole('EMPLOYER'), validate(invitesSchema), companyController.createInvites)
router.get('/company/invites', requireAuth, requireRole('EMPLOYER'), companyController.getInvites)

export default router
