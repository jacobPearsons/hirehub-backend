import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import bcrypt from 'bcryptjs'
import { prisma } from '../../lib/prisma'
import { env } from '../../config/env'
import { buildDemoBotReply, maybeScheduleDemoReply } from './demo-bot'

let employerId = ''
let demoCandidateId = ''
let demoSenderId = ''
let normalSeekerId = ''
let conversationDemo = ''
let conversationSender = ''
let conversationNormal = ''
const emails: string[] = []

async function createUser(email: string, name: string) {
  emails.push(email)
  const passwordHash = await bcrypt.hash('password123', 12)
  return prisma.user.create({ data: { email, name, passwordHash, role: 'SEEKER' } })
}

async function messageCount(conversationId: string) {
  return prisma.message.count({ where: { conversationId } })
}

describe('buildDemoBotReply', () => {
  it('answers a screening-question message with a tailored answer', () => {
    const reply = buildDemoBotReply('Q: How many years of React experience do you have?', 0)
    expect(reply).toContain('React')
  })

  it('falls back to a generic answer for an unknown question', () => {
    const reply = buildDemoBotReply('Q: What is your favorite color of spaceship?', 0)
    expect(reply.length).toBeGreaterThan(20)
  })

  it('rotates generic replies for non-question messages', () => {
    const first = buildDemoBotReply('Hello there', 0)
    const second = buildDemoBotReply('Hello there', 1)
    expect(first).not.toBe(second)
  })
})

describe('maybeScheduleDemoReply', () => {
  beforeAll(async () => {
    const employer = await prisma.user.create({
      data: { email: 'demo-bot-employer@example.com', name: 'Demo Bot Employer', passwordHash: await bcrypt.hash('password123', 12), role: 'EMPLOYER' },
    })
    emails.push(employer.email)
    employerId = employer.id
    const demoCandidate = await createUser('demo.candidate9@hirehub.community', 'Demo Bot Candidate')
    demoCandidateId = demoCandidate.id
    const demoSender = await createUser('demo.candidate8@hirehub.community', 'Demo Bot Sender')
    demoSenderId = demoSender.id
    const normalSeeker = await createUser('normal-seeker@example.com', 'Normal Seeker')
    normalSeekerId = normalSeeker.id

    conversationDemo = (await prisma.conversation.create({ data: { employerId, candidateId: demoCandidateId } })).id
    conversationSender = (await prisma.conversation.create({ data: { employerId, candidateId: demoSenderId } })).id
    conversationNormal = (await prisma.conversation.create({ data: { employerId, candidateId: normalSeekerId } })).id
  }, 30_000)

  afterAll(async () => {
    vi.useRealTimers()
    env.DEMO_BOT_ENABLED = false
    await prisma.message.deleteMany({
      where: { conversationId: { in: [conversationDemo, conversationSender, conversationNormal] } },
    })
    await prisma.conversation.deleteMany({
      where: { id: { in: [conversationDemo, conversationSender, conversationNormal] } },
    })
    await prisma.user.deleteMany({ where: { email: { in: emails } } })
  })

  it('does nothing when DEMO_BOT_ENABLED is off', async () => {
    env.DEMO_BOT_ENABLED = false
    const before = await messageCount(conversationDemo)
    await maybeScheduleDemoReply({ conversationId: conversationDemo, senderId: employerId, recipientId: demoCandidateId })
    vi.useFakeTimers()
    await vi.advanceTimersByTimeAsync(10_000)
    const after = await messageCount(conversationDemo)
    expect(after).toBe(before)
    vi.useRealTimers()
  })

  it('schedules a reply from the demo candidate after an employer message', async () => {
    env.DEMO_BOT_ENABLED = true
    vi.useFakeTimers()
    await prisma.message.create({
      data: { conversationId: conversationDemo, senderId: employerId, content: 'Q: How many years of React experience do you have?' },
    })
    await maybeScheduleDemoReply({ conversationId: conversationDemo, senderId: employerId, recipientId: demoCandidateId })
    await vi.advanceTimersByTimeAsync(10_000)
    const replies = await prisma.message.findMany({
      where: { conversationId: conversationDemo, senderId: demoCandidateId },
      orderBy: { createdAt: 'asc' },
    })
    expect(replies).toHaveLength(1)
    expect(replies[0].content).toContain('React')
    vi.useRealTimers()
  })

  it('does not reply when the sender is also a demo candidate (bot loop guard)', async () => {
    env.DEMO_BOT_ENABLED = true
    vi.useFakeTimers()
    const before = await messageCount(conversationSender)
    await maybeScheduleDemoReply({ conversationId: conversationSender, senderId: demoSenderId, recipientId: employerId })
    await vi.advanceTimersByTimeAsync(10_000)
    const after = await messageCount(conversationSender)
    expect(after).toBe(before)
    vi.useRealTimers()
  })

  it('does not reply when the recipient is not a demo candidate', async () => {
    env.DEMO_BOT_ENABLED = true
    vi.useFakeTimers()
    const before = await messageCount(conversationNormal)
    await maybeScheduleDemoReply({ conversationId: conversationNormal, senderId: employerId, recipientId: normalSeekerId })
    await vi.advanceTimersByTimeAsync(10_000)
    const after = await messageCount(conversationNormal)
    expect(after).toBe(before)
    vi.useRealTimers()
  })
})
