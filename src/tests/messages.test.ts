import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import app from '../app/app'
import { prisma } from '../lib/prisma'

let employerEmail = ''
let adminEmail = ''
let employerToken = ''
let employerUserId = ''
let adminUserId = ''
let conversationId = ''

describe('Messages Support Conversation', () => {
  beforeAll(async () => {
    const employerRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Support Employer',
        email: (employerEmail = `support-emp-${Date.now()}@example.com`),
        password: 'password123',
        role: 'EMPLOYER',
      })
    employerToken = employerRes.body.data.accessToken
    employerUserId = employerRes.body.data.user.id

    const adminRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'HireHub Admin',
        email: (adminEmail = `support-admin-${Date.now()}@example.com`),
        password: 'password123',
        role: 'SEEKER',
      })
    adminUserId = adminRes.body.data.user.id
    await prisma.user.update({ where: { id: adminUserId }, data: { role: 'ADMIN' } })
    const firstAdmin = await prisma.user.findFirst({ where: { role: 'ADMIN' } })
    adminUserId = firstAdmin!.id
    expect(firstAdmin!.role).toBe('ADMIN')
  })

  afterAll(async () => {
    if (conversationId) {
      await prisma.message.deleteMany({ where: { conversationId } })
    }
    const emails = [employerEmail, adminEmail].filter(Boolean)
    for (const email of emails) {
      await prisma.user.deleteMany({ where: { email } })
    }
  })

  describe('POST /api/conversations/support', () => {
    it('creates a conversation with an admin and sends a welcome message', async () => {
      const res = await request(app)
        .post('/api/conversations/support')
        .set('Authorization', `Bearer ${employerToken}`)
        .expect(200)

      conversationId = res.body.data.id
      expect(res.body.success).toBe(true)
      expect(res.body.data.employerId).toBe(employerUserId)
      expect(res.body.data.candidateId).toBe(adminUserId)

      const messageCount = await prisma.message.count({ where: { conversationId } })
      expect(messageCount).toBe(1)
      const welcome = await prisma.message.findFirst({ where: { conversationId } })
      expect(welcome?.content).toContain('Welcome to HireHub')
      expect(welcome?.senderId).toBe(adminUserId)

      const messagesRes = await request(app)
        .get(`/api/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${employerToken}`)
        .expect(200)
      const sender = messagesRes.body.data[0].sender
      expect(sender.role).toBe('ADMIN')
      expect(sender.id).toBe(adminUserId)
      expect(sender.name).toBeTruthy()
    })

    it('reuses an existing support conversation instead of creating duplicates', async () => {
      const first = await request(app)
        .post('/api/conversations/support')
        .set('Authorization', `Bearer ${employerToken}`)
      const second = await request(app)
        .post('/api/conversations/support')
        .set('Authorization', `Bearer ${employerToken}`)

      expect(first.body.data.id).toBe(second.body.data.id)
      expect(first.body.data.id).toBe(conversationId)

      const messageCount = await prisma.message.count({ where: { conversationId } })
      expect(messageCount).toBe(1)
    })

    it('returns 401 without a token', async () => {
      await request(app).post('/api/conversations/support').expect(401)
    })
  })
})
