import type { Request, Response, NextFunction } from 'express'
import { MessagesService } from './messages.service'
import { success, created } from '../../lib/response'

const messagesService = new MessagesService()

export async function listConversations(req: Request, res: Response, next: NextFunction) {
  try {
    const conversations = await messagesService.listConversations(req.user!.userId)
    success(res, conversations)
  } catch (error) {
    next(error)
  }
}

export async function getMessages(req: Request, res: Response, next: NextFunction) {
  try {
    const messages = await messagesService.getMessages(req.params.id as string, req.user!.userId)
    success(res, messages)
  } catch (error) {
    next(error)
  }
}

export async function sendMessage(req: Request, res: Response, next: NextFunction) {
  try {
    const { conversationId, content } = req.body
    const message = await messagesService.sendMessage(conversationId, req.user!.userId, content)
    created(res, message)
  } catch (error) {
    next(error)
  }
}

export async function createOrGetConversation(req: Request, res: Response, next: NextFunction) {
  try {
    const { employerId, candidateId, jobId } = req.body
    const conversation = await messagesService.createOrGetConversation(employerId, candidateId, jobId)
    success(res, conversation)
  } catch (error) {
    next(error)
  }
}

export async function openSupportConversation(req: Request, res: Response, next: NextFunction) {
  try {
    const conversation = await messagesService.openSupportConversation(req.user!.userId)
    success(res, conversation)
  } catch (error) {
    next(error)
  }
}
