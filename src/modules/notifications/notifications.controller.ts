import type { Request, Response } from 'express'
import { addClient } from '../../services/sse'
import { success } from '../../lib/response'
import { notificationsService } from './notifications.service'

export function streamNotifications(req: Request, res: Response) {
  const added = addClient(req.user!.userId, res)
  if (!added) {
    res.status(429).json({ error: 'Too many connections' })
    return
  }

  const keepalive = setInterval(() => {
    res.write(':keepalive\n\n')
  }, 30000)

  req.on('close', () => {
    clearInterval(keepalive)
  })
}

export async function listNotifications(req: Request, res: Response) {
  const items = await notificationsService.listForUser(req.user!.userId)
  success(res, { items, unreadCount: items.filter((item) => !item.read).length })
}

export async function markNotificationRead(req: Request, res: Response) {
  success(res, await notificationsService.markRead(req.params.id as string, req.user!.userId))
}

export async function markAllNotificationsRead(req: Request, res: Response) {
  success(res, await notificationsService.markAllRead(req.user!.userId))
}
