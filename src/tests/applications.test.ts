import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import app from '../app/app'
import { prisma } from '../lib/prisma'

let employerEmail = ''
let seekerEmail = ''
let employerToken = ''
let seekerToken = ''
let createdJobId = ''
let createdApplicationId = ''

describe('Applications Routes', () => {
  beforeAll(async () => {
    const employerRes = await request(app)
      .post('/api/auth/register')
      .send({ name: 'App Employer', email: (employerEmail = `app-emp-${Date.now()}@example.com`), password: 'password123', role: 'EMPLOYER' })
    employerToken = employerRes.body.data.accessToken

    const seekerRes = await request(app)
      .post('/api/auth/register')
      .send({ name: 'App Seeker', email: (seekerEmail = `app-seeker-${Date.now()}@example.com`), password: 'password123', role: 'SEEKER' })
    seekerToken = seekerRes.body.data.accessToken

    const jobRes = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${employerToken}`)
      .send({
        title: 'Test Job for Applications',
        company: 'App Test Corp',
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
    if (createdApplicationId) {
      await prisma.application.deleteMany({ where: { id: createdApplicationId } })
    }
    if (createdJobId) {
      await prisma.job.deleteMany({ where: { id: createdJobId } })
    }
    const emails = [employerEmail, seekerEmail].filter(Boolean)
    for (const email of emails) {
      await prisma.user.deleteMany({ where: { email } })
    }
  })

  describe('POST /api/applications', () => {
    it('should create application when seeker', async () => {
      const res = await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${seekerToken}`)
        .send({
          jobId: createdJobId,
          applicantName: 'App Seeker',
          applicantEmail: `app-seeker-app-${Date.now()}@example.com`,
          coverLetter: 'I am interested in this position.',
        })
        .expect(201)

      expect(res.body.success).toBe(true)
      expect(res.body.data.id).toBeDefined()
      createdApplicationId = res.body.data.id
    })

    it('should return 403 when employer tries to apply', async () => {
      const res = await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${employerToken}`)
        .send({
          jobId: createdJobId,
          applicantName: 'Employer',
          applicantEmail: 'emp@test.com',
          coverLetter: 'Should fail',
        })
        .expect(403)

      expect(res.body.success).toBe(false)
    })
  })

  describe('GET /api/applications', () => {
    it('should return seeker applications', async () => {
      const res = await request(app)
        .get('/api/applications')
        .set('Authorization', `Bearer ${seekerToken}`)
        .expect(200)

      expect(res.body.success).toBe(true)
      expect(Array.isArray(res.body.data)).toBe(true)
    })
  })

  describe('PATCH /api/applications/:id/status', () => {
    it('should update status when employer', async () => {
      const res = await request(app)
        .patch(`/api/applications/${createdApplicationId}/status`)
        .set('Authorization', `Bearer ${employerToken}`)
        .send({ status: 'REVIEWING' })
        .expect(200)

      expect(res.body.success).toBe(true)
    })
  })
})
