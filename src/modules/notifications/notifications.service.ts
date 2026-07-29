import { sendToUser } from '../../services/sse'
import type { Message } from '@prisma/client'

export function notifyNewMessage(recipientId: string, message: Message & { sender: { id: string; name: string; avatarUrl: string | null } }) {
  sendToUser(recipientId, 'new-message', message)
}
