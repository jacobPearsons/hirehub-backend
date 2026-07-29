import { prisma } from '../../lib/prisma'
import { NotFoundError, AuthorizationError } from '../../middleware/error-handler'
import { sendToUser } from '../../services/sse'

export class MessagesService {
  async listConversations(userId: string) {
    return prisma.conversation.findMany({
      where: { OR: [{ employerId: userId }, { candidateId: userId }] },
      include: {
        employer: { select: { id: true, name: true, avatarUrl: true } },
        candidate: { select: { id: true, name: true, avatarUrl: true } },
        job: { select: { id: true, title: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { sender: { select: { id: true, name: true, avatarUrl: true } } },
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
      include: { sender: { select: { id: true, name: true, avatarUrl: true } } },
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
      include: { sender: { select: { id: true, name: true, avatarUrl: true } } },
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
}
