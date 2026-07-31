import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import app from '../app/app'
import { prisma } from '../lib/prisma'

const testEmail = `test-onboarding-${Date.now()}@example.com`
let accessToken = ''

describe('Onboarding Wizard', () => {
  beforeAll(async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Onboarding User', email: testEmail, password: 'password123' })
    accessToken = res.body.data.accessToken
  })

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: testEmail } })
  })

  describe('PATCH /api/auth/profile onboarding fields', () => {
    it('should accept onboarding fields and reflect them in the response', async () => {
      const res = await request(app)
        .patch('/api/auth/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          headline: 'Senior Full-Stack Engineer',
          location: 'Lisbon, Portugal',
          skills: ['a', 'b', 'c'],
          remoteOnly: true,
          salaryMin: 60000,
          salaryMax: 90000,
          currency: 'USD',
          employmentType: 'Full-time',
        })
        .expect(200)

      expect(res.body.success).toBe(true)
      expect(res.body.data.headline).toBe('Senior Full-Stack Engineer')
      expect(res.body.data.location).toBe('Lisbon, Portugal')
      expect(res.body.data.skills).toEqual(['a', 'b', 'c'])
      expect(res.body.data.remoteOnly).toBe(true)
      expect(res.body.data.salaryMin).toBe(60000)
      expect(res.body.data.salaryMax).toBe(90000)
      expect(res.body.data.currency).toBe('USD')
      expect(res.body.data.employmentType).toBe('Full-time')
    })

    it('should reject an empty skills array', async () => {
      const res = await request(app)
        .patch('/api/auth/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ skills: [] })
        .expect(400)

      expect(res.body.success).toBe(false)
    })

    it('should reject more than 15 skills', async () => {
      const res = await request(app)
        .patch('/api/auth/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ skills: Array.from({ length: 16 }, (_, i) => `skill-${i}`) })
        .expect(400)

      expect(res.body.success).toBe(false)
    })

    it('should reject a negative salaryMin', async () => {
      const res = await request(app)
        .patch('/api/auth/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ salaryMin: -1 })
        .expect(400)

      expect(res.body.success).toBe(false)
    })

    it('should accept onboardingCompleted: true and return it', async () => {
      const res = await request(app)
        .patch('/api/auth/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ onboardingCompleted: true })
        .expect(200)

      expect(res.body.success).toBe(true)
      expect(res.body.data.onboardingCompleted).toBe(true)
    })
  })
})
