import { describe, it, expect, afterAll } from 'vitest'
import request from 'supertest'
import app from '../app/app'
import { prisma } from '../lib/prisma'

const testEmail = `contact-test-${Date.now()}@example.com`

describe('Contact Routes', () => {
  afterAll(async () => {
    await prisma.contactSubmission.deleteMany({ where: { email: testEmail } })
  })

  describe('POST /api/contact', () => {
    it('should create a contact submission', async () => {
      const res = await request(app)
        .post('/api/contact')
        .send({
          name: 'Contact Tester',
          email: testEmail,
          subject: 'Test Subject',
          message: 'This is a test message for the contact form.',
        })
        .expect(201)
      expect(res.body.success).toBe(true)
      expect(res.body.data.id).toBeDefined()
    })

    it('should return 400 for missing name', async () => {
      await request(app)
        .post('/api/contact')
        .send({ email: testEmail, subject: 'Sub', message: 'Msg' })
        .expect(400)
    })

    it('should return 400 for invalid email', async () => {
      await request(app)
        .post('/api/contact')
        .send({ name: 'X', email: 'not-an-email', subject: 'Sub', message: 'Msg' })
        .expect(400)
    })

    it('should return 400 for missing message', async () => {
      await request(app)
        .post('/api/contact')
        .send({ name: 'X', email: testEmail, subject: 'Sub' })
        .expect(400)
    })

    it('should return 400 for empty body', async () => {
      await request(app)
        .post('/api/contact')
        .send({})
        .expect(400)
    })
  })
})
