import { prisma } from '../../lib/prisma'
import { env } from '../../config/env'
import { sendToUser } from '../../services/sse'
import { isDemoCandidateEmail } from './demo.types'

const GENERIC_REPLIES = [
  "Thanks for the message! I'm excited about this opportunity and happy to share more.",
  "That sounds great. I'm really interested in moving forward with the team.",
  "Appreciate the update. Let me know if you need anything else from me.",
  "Happy to elaborate on anything from my application. Looking forward to the next step!",
] as const

const QUESTION_ANSWERS: { keywords: string[]; answer: string }[] = [
  {
    keywords: ['react', 'frontend'],
    answer:
      "I've been building with React and TypeScript for about four years, including design systems and performance work.",
  },
  {
    keywords: ['design', 'systems', 'figma'],
    answer:
      "I've led the design system at my last two companies, building token-driven components in Figma.",
  },
  {
    keywords: ['portfolio'],
    answer:
      "I'd love to walk you through my portfolio - the highlights are the products where I took a feature from research to shipped UI.",
  },
  {
    keywords: ['sql', 'data', 'dashboard'],
    answer:
      "I work daily in SQL and Python, and I've built dashboards that teams rely on for weekly decisions.",
  },
  {
    keywords: ['years', 'experience'],
    answer:
      'I have over five years of relevant experience, most recently owning end-to-end delivery on a cross-functional team.',
  },
]

const FALLBACK_ANSWER =
  "Great question. I've thought about this a lot in my recent projects and I'm happy to walk you through my approach in detail."

const MIN_REPLY_DELAY_MS = 1500
const MAX_REPLY_DELAY_MS = 6000
const WELCOME_PREFIX = 'Welcome to your HireHub interview'

export function buildDemoBotReply(incomingContent: string, replyCount: number): string {
  if (incomingContent.startsWith('Q: ')) {
    const prompt = incomingContent.slice(3).toLowerCase()
    const hit = QUESTION_ANSWERS.find((entry) => entry.keywords.some((kw) => prompt.includes(kw)))
    return hit?.answer ?? FALLBACK_ANSWER
  }
  return GENERIC_REPLIES[replyCount % GENERIC_REPLIES.length]
}

export async function maybeScheduleDemoReply(input: {
  conversationId: string
  senderId: string
  recipientId: string
}): Promise<void> {
  if (!env.DEMO_BOT_ENABLED) return

  const [sender, recipient] = await Promise.all([
    prisma.user.findUnique({ where: { id: input.senderId }, select: { email: true } }),
    prisma.user.findUnique({ where: { id: input.recipientId }, select: { email: true } }),
  ])
  if (!recipient || !isDemoCandidateEmail(recipient.email)) return
  if (sender && isDemoCandidateEmail(sender.email)) return

  const lastMessage = await prisma.message.findFirst({
    where: { conversationId: input.conversationId, senderId: input.senderId },
    orderBy: { createdAt: 'desc' },
  })
  if (!lastMessage || lastMessage.content.startsWith(WELCOME_PREFIX)) return

  const botReplyCount = await prisma.message.count({
    where: { conversationId: input.conversationId, senderId: input.recipientId },
  })
  const reply = buildDemoBotReply(lastMessage.content, botReplyCount)

  const delay =
    MIN_REPLY_DELAY_MS + Math.floor(Math.random() * (MAX_REPLY_DELAY_MS - MIN_REPLY_DELAY_MS))
  setTimeout(() => {
    prisma.message
      .create({
        data: { conversationId: input.conversationId, senderId: input.recipientId, content: reply },
        include: { sender: { select: { id: true, name: true, avatarUrl: true, role: true } } },
      })
      .then((message) => {
        sendToUser(input.senderId, 'new-message', message)
      })
      .catch((error) => {
        console.error('Demo bot failed to send reply:', error)
      })
  }, delay)
}
