import { Router } from 'express'
import { requireAuth, requireRole } from '../../middleware/auth'
import * as auditController from './audit.controller'

const router = Router()

router.get('/audit/events', requireAuth, requireRole('ADMIN'), auditController.listEvents)

export default router
