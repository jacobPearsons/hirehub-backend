import { sendToUser } from '../../services/sse'
import { prisma } from '../../lib/prisma'
import { NotFoundError } from '../../middleware/error-handler'
import type { Prisma, Message, NotificationType } from '@prisma/client'

export function notifyNewMessage(recipientId: string, message: Message & { sender: { id: string; name: string; avatarUrl: string | null } }) {
  sendToUser(recipientId, 'new-message', message)
}

export class NotificationsService {
  async createForUser(userId: string, input: { type: NotificationType; title: string; body: string; data?: unknown }) {
    const notification = await prisma.notification.create({
      data: {
        userId,
        type: input.type,
        title: input.title,
        body: input.body,
        ...(input.data !== undefined ? { data: input.data as Prisma.InputJsonValue } : {}),
      },
    })

    sendToUser(userId, 'notification', notification)

    return notification
  }

  async listForUser(userId: string) {
    return prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })
  }

  async markRead(id: string, userId: string) {
    const { count } = await prisma.notification.updateMany({
      where: { id, userId },
      data: { read: true },
    })
    if (count === 0) throw new NotFoundError('Notification')
    return prisma.notification.findUnique({ where: { id } })
  }

  async markAllRead(userId: string) {
    const result = await prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    })
    return { count: result.count }
  }
}

export const notificationsService = new NotificationsService()
