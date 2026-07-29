import { Router } from 'express'
import { requireAuth, requireRole } from '../../middleware/auth'
import * as analyticsController from './analytics.controller'

const router = Router()

router.get('/analytics/employer', requireAuth, requireRole('EMPLOYER'), analyticsController.getEmployerDashboard)

export default router
