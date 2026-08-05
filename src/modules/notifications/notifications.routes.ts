import { Router } from 'express'
import { requireAuth, requireAuthQuery } from '../../middleware/auth'
import {
  streamNotifications,
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from './notifications.controller'

const router = Router()

router.get('/notifications/stream', requireAuthQuery, streamNotifications)
router.get('/notifications', requireAuth, listNotifications)
router.post('/notifications/:id/read', requireAuth, markNotificationRead)
router.post('/notifications/read-all', requireAuth, markAllNotificationsRead)

export default router
