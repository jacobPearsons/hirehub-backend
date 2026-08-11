import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import app from '../app/app'
import { prisma } from '../lib/prisma'

let employerEmail = ''
let seekerEmail = ''
let adminEmail = ''
let employerToken = ''
let seekerToken = ''
let adminToken = ''
let seekerUserId = ''
let createdJobId = ''
let createdNotificationId = ''
let createdApplicationId = ''
let createdFlowNotificationId = ''

describe('Notifications Routes', () => {
  beforeAll(async () => {
    const employerRes = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Notif Employer', email: (employerEmail = `notif-emp-${Date.now()}@example.com`), password: 'password123', role: 'EMPLOYER' })
    employerToken = employerRes.body.data.accessToken

    const seekerRes = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Notif Seeker', email: (seekerEmail = `notif-seeker-${Date.now()}@example.com`), password: 'password123', role: 'SEEKER' })
    seekerToken = seekerRes.body.data.accessToken
    seekerUserId = seekerRes.body.data.user.id

    await request(app)
      .post('/api/auth/register')
      .send({ name: 'Notif Admin', email: (adminEmail = `notif-admin-${Date.now()}@example.com`), password: 'password123' })
    await prisma.user.update({ where: { email: adminEmail }, data: { role: 'ADMIN' } })
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: adminEmail, password: 'password123' })
    adminToken = adminLogin.body.data.accessToken

    const jobRes = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${employerToken}`)
      .send({
        title: 'Test Job for Notifications',
        company: 'Notif Test Corp',
        location: 'Remote',
        remote: true,
        category: 'Engineering',
        seniority: 'Junior',
        description: 'Test description',
        requirements: ['Python'],
        responsibilities: ['Write code'],
        tags: ['python'],
      })
    createdJobId = jobRes.body.data.id
  })

  afterAll(async () => {
    if (createdNotificationId) {
      await prisma.notification.deleteMany({ where: { id: createdNotificationId } })
    }
    if (createdFlowNotificationId) {
      await prisma.notification.deleteMany({ where: { id: createdFlowNotificationId } })
    }
    if (createdApplicationId) {
      await prisma.application.deleteMany({ where: { id: createdApplicationId } })
    }
    if (createdJobId) {
      await prisma.job.deleteMany({ where: { id: createdJobId } })
    }
    const emails = [employerEmail, seekerEmail, adminEmail].filter(Boolean)
    for (const email of emails) {
      await prisma.user.deleteMany({ where: { email } })
    }
  })

  describe('GET /api/notifications', () => {
    it('should seed a notification for the seeker', async () => {
      const notification = await prisma.notification.create({
        data: {
          userId: seekerUserId,
          type: 'APPLICATION_STATUS',
          title: 'Application status update',
          body: 'Your application is being reviewed',
        },
      })
      expect(notification.id).toBeDefined()
      createdNotificationId = notification.id
    })

    it('should return seeker notifications with unread count', async () => {
      const res = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${seekerToken}`)
        .expect(200)

      expect(res.body.success).toBe(true)
      expect(Array.isArray(res.body.data.items)).toBe(true)
      expect(res.body.data.unreadCount).toBe(1)
      expect(res.body.data.items.some((item: { id: string }) => item.id === createdNotificationId)).toBe(true)
    })

    it('should not leak seeker notifications to the employer', async () => {
      const res = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${employerToken}`)
        .expect(200)

      expect(res.body.success).toBe(true)
      expect(res.body.data.items.some((item: { id: string }) => item.id === createdNotificationId)).toBe(false)
    })
  })

  describe('POST /api/notifications/:id/read', () => {
    it('should mark a notification as read when owner', async () => {
      const res = await request(app)
        .post(`/api/notifications/${createdNotificationId}/read`)
        .set('Authorization', `Bearer ${seekerToken}`)
        .expect(200)

      expect(res.body.success).toBe(true)
      expect(res.body.data.read).toBe(true)
    })

    it('should return 404 when another user marks it as read', async () => {
      const res = await request(app)
        .post(`/api/notifications/${createdNotificationId}/read`)
        .set('Authorization', `Bearer ${employerToken}`)
        .expect(404)

      expect(res.body.success).toBe(false)
    })
  })

  describe('POST /api/notifications/read-all', () => {
    it('should mark all notifications as read', async () => {
      await prisma.notification.create({
        data: {
          userId: seekerUserId,
          type: 'SYSTEM',
          title: 'System notice',
          body: 'An unread system notice',
        },
      })

      const res = await request(app)
        .post('/api/notifications/read-all')
        .set('Authorization', `Bearer ${seekerToken}`)
        .expect(200)

      expect(res.body.success).toBe(true)
      expect(typeof res.body.data.count).toBe('number')

      const list = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${seekerToken}`)
        .expect(200)

      expect(list.body.data.unreadCount).toBe(0)
    })
  })

  describe('GET /api/notifications/stream', () => {
    it('should open an SSE stream with a token query param', async () => {
      const server = app.listen(0)
      try {
        await new Promise<void>((resolve, reject) => {
          server.on('listening', () => {
            const { port } = server.address() as { port: number }
            request(`http://127.0.0.1:${port}`)
              .get('/api/notifications/stream')
              .query({ token: seekerToken })
              .buffer(false)
              .end((err, res) => {
                try {
                  expect(err).toBeNull()
                  expect(res.status).toBe(200)
                  expect(res.headers['content-type']).toMatch(/text\/event-stream/)
                  const raw = res as unknown as { res: { destroy: () => void } }
                  raw.res.destroy()
                  resolve()
                } catch (e) {
                  const raw = res as unknown as { res: { destroy: () => void } }
                  raw.res?.destroy()
                  reject(e)
                }
              })
          })
          server.on('error', reject)
        })
      } finally {
        server.close()
      }
    })

    it('should return 401 without a token', async () => {
      const res = await request(app)
        .get('/api/notifications/stream')
        .expect(401)

      expect(res.body.success).toBe(false)
    })
  })

  describe('Application status change notifies the candidate', () => {
    it('should create an APPLICATION_STATUS notification when an ADMIN updates the status', async () => {
      const applyRes = await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${seekerToken}`)
        .send({
          jobId: createdJobId,
          applicantName: 'Notif Seeker',
          applicantEmail: `notif-seeker-app-${Date.now()}@example.com`,
          coverLetter: 'I am interested in this position.',
        })
        .expect(201)
      createdApplicationId = applyRes.body.data.id

      const patchRes = await request(app)
        .patch(`/api/applications/${createdApplicationId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'SCREENING' })
        .expect(200)
      expect(patchRes.body.success).toBe(true)

      const res = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${seekerToken}`)
        .expect(200)

      const statusNotifications = res.body.data.items.filter(
        (item: { type: string; read: boolean }) => item.type === 'APPLICATION_STATUS' && item.read === false,
      )
      expect(statusNotifications).toHaveLength(1)
      expect(statusNotifications[0].body).toContain('Test Job for Notifications')
      createdFlowNotificationId = statusNotifications[0].id
    })
  })
})
