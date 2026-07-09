import { Router } from 'express'
import { requireAuth, requireRole } from '../../middleware/auth'
import * as uploadController from './upload.controller'

const router = Router()

router.post('/upload/resume', requireAuth, requireRole('SEEKER'), uploadController.uploadResumeHandler)

export default router
