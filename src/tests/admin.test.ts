import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import app from '../app/app'
import { prisma } from '../lib/prisma'

const adminEmail = `test-admin-${Date.now()}@example.com`
const empEmail = `test-admin-emp-${Date.now()}@example.com`
let adminToken = ''
let empToken = ''
let empUserId = ''

describe('Admin Routes', () => {
  beforeAll(async () => {
    const adminRes = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Test Admin', email: adminEmail, password: 'password123' })

    await prisma.user.update({
      where: { email: adminEmail },
      data: { role: 'ADMIN' },
    })

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: adminEmail, password: 'password123' })
    adminToken = loginRes.body.data.accessToken

    const empRes = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Admin Emp', email: empEmail, password: 'password123', role: 'EMPLOYER' })
    empToken = empRes.body.data.accessToken
    empUserId = empRes.body.data.user.id
  }, 30_000)

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: [adminEmail, empEmail] } } })
  })

  describe('GET /api/admin/users', () => {
    it('should return all users when admin', async () => {
      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
      expect(res.body.success).toBe(true)
      expect(Array.isArray(res.body.data)).toBe(true)
      expect(res.body.data.length).toBeGreaterThanOrEqual(2)
    })

    it('should return 403 for non-admin', async () => {
      await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${empToken}`)
        .expect(403)
    })

    it('should return 401 without token', async () => {
      await request(app)
        .get('/api/admin/users')
        .expect(401)
    })
  })

  describe('PATCH /api/admin/users/:id/role', () => {
    it('should update user role when admin', async () => {
      const res = await request(app)
        .patch(`/api/admin/users/${empUserId}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'SEEKER' })
        .expect(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data.role).toBe('SEEKER')
    })

    it('should revoke all refresh tokens when role is changed', async () => {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: empEmail, password: 'password123' })
      const staleRefresh = loginRes.body.data.refreshToken

      await request(app)
        .patch(`/api/admin/users/${empUserId}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'EMPLOYER' })

      const refreshRes = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: staleRefresh })
      expect(refreshRes.status).toBe(401)
    })

    it('should return 403 for non-admin', async () => {
      await request(app)
        .patch(`/api/admin/users/${empUserId}/role`)
        .set('Authorization', `Bearer ${empToken}`)
        .send({ role: 'EMPLOYER' })
        .expect(403)
    })
  })

  describe('GET /api/admin/jobs', () => {
    it('should return all jobs when admin', async () => {
      const res = await request(app)
        .get('/api/admin/jobs')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
      expect(res.body.success).toBe(true)
      expect(Array.isArray(res.body.data)).toBe(true)
    })
  })

  describe('GET /api/admin/applications', () => {
    it('should return all applications when admin', async () => {
      const res = await request(app)
        .get('/api/admin/applications')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
      expect(res.body.success).toBe(true)
      expect(Array.isArray(res.body.data)).toBe(true)
    })

    it('should return 403 for non-admin', async () => {
      await request(app)
        .get('/api/admin/applications')
        .set('Authorization', `Bearer ${empToken}`)
        .expect(403)
    })
  })

  describe('GET /api/admin/employers', () => {
    it('should return employer accounts when admin', async () => {
      const res = await request(app)
        .get('/api/admin/employers')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
      expect(res.body.success).toBe(true)
      expect(Array.isArray(res.body.data)).toBe(true)
      expect(res.body.data.length).toBeGreaterThan(0)
      expect(res.body.data[0]).toHaveProperty('id')
      expect(res.body.data[0]).toHaveProperty('email')
      expect(res.body.data[0]).toHaveProperty('companyName')
      expect(res.body.data[0]._count).toHaveProperty('jobListings')
    })

    it('should return 403 for non-admin', async () => {
      await request(app)
        .get('/api/admin/employers')
        .set('Authorization', `Bearer ${empToken}`)
        .expect(403)
    })
  })

  describe('GET /api/admin/blog-posts', () => {
    it('should return all blog posts when admin', async () => {
      const res = await request(app)
        .get('/api/admin/blog-posts')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
      expect(res.body.success).toBe(true)
      expect(Array.isArray(res.body.data)).toBe(true)
    })
  })
})
