import { prisma } from '../../lib/prisma'
import { NotFoundError, AuthorizationError } from '../../middleware/error-handler'
import { sendToUser } from '../../services/sse'

export class MessagesService {
  async listConversations(userId: string) {
    return prisma.conversation.findMany({
      where: { OR: [{ employerId: userId }, { candidateId: userId }] },
      include: {
        employer: { select: { id: true, name: true, avatarUrl: true, role: true } },
        candidate: { select: { id: true, name: true, avatarUrl: true, role: true } },
        job: { select: { id: true, title: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { sender: { select: { id: true, name: true, avatarUrl: true, role: true } } },
        },
      },
      orderBy: { updatedAt: 'desc' },
    })
  }

  async getMessages(conversationId: string, userId: string) {
    const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } })
    if (!conversation) throw new NotFoundError('Conversation')
    if (conversation.employerId !== userId && conversation.candidateId !== userId) {
      throw new AuthorizationError()
    }
    return prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      include: { sender: { select: { id: true, name: true, avatarUrl: true, role: true } } },
    })
  }

  async sendMessage(conversationId: string, senderId: string, content: string) {
    const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } })
    if (!conversation) throw new NotFoundError('Conversation')
    if (conversation.employerId !== senderId && conversation.candidateId !== senderId) {
      throw new AuthorizationError('You are not a participant in this conversation')
    }
    const message = await prisma.message.create({
      data: { conversationId, senderId, content },
      include: { sender: { select: { id: true, name: true, avatarUrl: true, role: true } } },
    })

    const recipientId = conversation.employerId === senderId ? conversation.candidateId : conversation.employerId
    sendToUser(recipientId, 'new-message', message)

    return message
  }

  async createOrGetConversation(employerId: string, candidateId: string, jobId?: string) {
    let conversation = await prisma.conversation.findFirst({
      where: { employerId, candidateId, jobId: jobId ?? null },
    })
    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: { employerId, candidateId, jobId },
      })
    }
    return conversation
  }

  async openSupportConversation(userId: string) {
    const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } })
    if (!admin) throw new NotFoundError('Admin')
    const conversation = await this.createOrGetConversation(userId, admin.id)
    const existing = await prisma.message.count({ where: { conversationId: conversation.id } })
    if (existing === 0) {
      await this.sendMessage(
        conversation.id,
        admin.id,
        'Welcome to HireHub! The HireHub team is here to help you get started.',
      )
    }
    return conversation
  }
}
