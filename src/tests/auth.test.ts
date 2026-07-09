import { describe, it, expect, afterAll } from 'vitest'
import request from 'supertest'
import app from '../app/app'
import { prisma } from '../lib/prisma'

const testUser = {
  name: 'Test User',
  email: `test-auth-${Date.now()}@example.com`,
  password: 'password123',
}
let accessToken = ''

describe('Auth Routes', () => {
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: testUser.email } })
  })

  describe('POST /api/auth/register', () => {
    it('should register a new user', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send(testUser)
        .expect(201)

      expect(res.body.success).toBe(true)
      expect(res.body.data.user.email).toBe(testUser.email)
      expect(res.body.data.accessToken).toBeDefined()
      accessToken = res.body.data.accessToken
    })

    it('should return 409 for duplicate email', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send(testUser)
        .expect(409)

      expect(res.body.success).toBe(false)
      expect(res.body.error).toMatch(/already registered/i)
    })

    it('should return 400 for missing fields', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({})
        .expect(400)

      expect(res.body.success).toBe(false)
    })
  })

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: testUser.email, password: testUser.password })
        .expect(200)

      expect(res.body.success).toBe(true)
      expect(res.body.data.accessToken).toBeDefined()
      accessToken = res.body.data.accessToken
    })

    it('should return 401 for wrong password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: testUser.email, password: 'wrongpassword' })
        .expect(401)

      expect(res.body.success).toBe(false)
    })

    it('should return 401 for non-existent user', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nonexistent@example.com', password: 'password123' })
        .expect(401)

      expect(res.body.success).toBe(false)
    })
  })

  describe('GET /api/auth/me', () => {
    it('should return user with valid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)

      expect(res.body.success).toBe(true)
      expect(res.body.data.email).toBe(testUser.email)
    })

    it('should return 401 without token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .expect(401)

      expect(res.body.success).toBe(false)
    })
  })

  describe('POST /api/auth/forgot-password', () => {
    it('should return success', async () => {
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: testUser.email })
        .expect(200)

      expect(res.body.success).toBe(true)
    })

    it('should return success even for unknown email', async () => {
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'unknown@example.com' })
        .expect(200)

      expect(res.body.success).toBe(true)
    })
  })
})
