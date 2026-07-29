import { Router } from 'express'
import { requireAuth } from '../../middleware/auth'
import { validate } from '../../middleware/validate'
import { z } from 'zod'
import * as messagesController from './messages.controller'

const router = Router()

const createConversationSchema = z.object({
  employerId: z.string().min(1),
  candidateId: z.string().min(1),
  jobId: z.string().optional(),
})

const sendMessageSchema = z.object({
  conversationId: z.string().min(1),
  content: z.string().min(1).max(10000),
})

router.get('/conversations', requireAuth, messagesController.listConversations)
router.post('/conversations', requireAuth, validate(createConversationSchema), messagesController.createOrGetConversation)
router.get('/conversations/:id/messages', requireAuth, messagesController.getMessages)
router.post('/messages', requireAuth, validate(sendMessageSchema), messagesController.sendMessage)

export default router
