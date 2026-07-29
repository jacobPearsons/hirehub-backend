import { Router } from 'express'
import { requireAuth } from '../../middleware/auth'
import { streamNotifications } from './notifications.controller'

const router = Router()

router.get('/notifications/stream', requireAuth, streamNotifications)

export default router
