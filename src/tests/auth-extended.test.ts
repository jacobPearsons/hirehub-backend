import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import app from '../app/app'
import { prisma } from '../lib/prisma'

const testEmail = `test-auth-ext-${Date.now()}@example.com`
const promoteEmail = `test-auth-promote-${Date.now()}@example.com`
let accessToken = ''
let refreshCookie = ''

describe('Auth Extended Routes', () => {
  beforeAll(async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Auth Ext User', email: testEmail, password: 'password123' })
    accessToken = res.body.data.accessToken

    const setCookie = res.headers['set-cookie']
    if (Array.isArray(setCookie)) {
      const cookie = setCookie.find((c: string) => c.startsWith('refreshToken='))
      if (cookie) refreshCookie = cookie.split(';')[0]
    }
  })

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: [testEmail, promoteEmail] } } })
  })

  describe('POST /api/auth/logout', () => {
    it('should logout and invalidate refresh token', async () => {
      // First re-login to get a valid refresh cookie
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: testEmail, password: 'password123' })
      const setCookie = loginRes.headers['set-cookie']
      if (Array.isArray(setCookie)) {
        const cookie = setCookie.find((c: string) => c.startsWith('refreshToken='))
        if (cookie) refreshCookie = cookie.split(';')[0]
      }

      await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Cookie', refreshCookie)
        .expect(200)

      const res = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', refreshCookie)
        .expect(401)

      expect(res.body.success).toBe(false)
    })

    it('should return 401 without token', async () => {
      await request(app)
        .post('/api/auth/logout')
        .expect(401)
    })
  })

  describe('POST /api/auth/refresh', () => {
    let localRefreshCookie = ''

    beforeAll(async () => {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: testEmail, password: 'password123' })

      const setCookie = loginRes.headers['set-cookie']
      if (Array.isArray(setCookie)) {
        const cookie = setCookie.find((c: string) => c.startsWith('refreshToken='))
        if (cookie) localRefreshCookie = cookie.split(';')[0]
      }
    })

    it('should issue new token pair with valid refresh cookie', async () => {
      expect(localRefreshCookie).toBeTruthy()

      const res = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', localRefreshCookie)
        .expect(200)

      expect(res.body.success).toBe(true)
      expect(res.body.data.accessToken).toBeDefined()

      const oldRes = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', localRefreshCookie)
        .expect(401)

      expect(oldRes.body.success).toBe(false)
    })

    it('should return 401 with no refresh cookie', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .expect(401)

      expect(res.body.success).toBe(false)
    })

    it('should return 401 with invalid refresh cookie', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', 'refreshToken=invalid-token-abc')
        .expect(401)

      expect(res.body.success).toBe(false)
    })
  })

  describe('Password Reset Flow', () => {
    let resetToken = ''

    it('should create a reset token via forgot-password', async () => {
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: testEmail })
        .expect(200)

      expect(res.body.success).toBe(true)

      const tokenRecord = await prisma.resetToken.findFirst({
        where: { user: { email: testEmail } },
        orderBy: { createdAt: 'desc' },
      })
      resetToken = tokenRecord?.token ?? ''
      expect(resetToken).toBeTruthy()
    })

    it('should reset password with valid token', async () => {
      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: resetToken, password: 'newpassword456' })
        .expect(200)

      expect(res.body.success).toBe(true)

      // login with new password should work
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: testEmail, password: 'newpassword456' })
        .expect(200)

      expect(loginRes.body.data.accessToken).toBeDefined()

      // old password should not work
      await request(app)
        .post('/api/auth/login')
        .send({ email: testEmail, password: 'password123' })
        .expect(401)
    })

    it('should return 400 with expired/invalid reset token', async () => {
      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: 'invalid-reset-token', password: 'newpassword789' })
        .expect(400)

      expect(res.body.success).toBe(false)
    })
  })

  describe('Refresh token picks up role changes from DB', () => {
    it('should reflect role promotion after refresh', async () => {
      const regRes = await request(app)
        .post('/api/auth/register')
        .send({ name: 'Promote Me', email: promoteEmail, password: 'password123', role: 'SEEKER' })

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: promoteEmail, password: 'password123' })
      const oldAccess = loginRes.body.data.accessToken
      const oldPayload = JSON.parse(Buffer.from(oldAccess.split('.')[1], 'base64').toString())
      expect(oldPayload.role).toBe('SEEKER')

      const setCookie = loginRes.headers['set-cookie']
      let refreshCookie = ''
      if (Array.isArray(setCookie)) {
        const cookie = setCookie.find((c: string) => c.startsWith('refreshToken='))
        if (cookie) refreshCookie = cookie.split(';')[0]
      }
      expect(refreshCookie).toBeTruthy()

      await prisma.user.update({ where: { email: promoteEmail }, data: { role: 'ADMIN' } })

      const refreshRes = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', refreshCookie)
        .expect(200)

      const newAccess = refreshRes.body.data.accessToken
      const newPayload = JSON.parse(Buffer.from(newAccess.split('.')[1], 'base64').toString())
      expect(newPayload.role).toBe('ADMIN')
    })
  })
})
