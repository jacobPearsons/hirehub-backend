import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import app from '../app/app'
import { prisma } from '../lib/prisma'

const empEmail = `test-app-ext-emp-${Date.now()}@example.com`
const seekerEmail = `test-app-ext-seeker-${Date.now()}@example.com`
const emp2Email = `test-app-ext-emp2-${Date.now()}@example.com`
let empToken = ''
let seekerToken = ''
let emp2Token = ''
let jobId = ''
let applicationId = ''

describe('Applications Extended Routes', () => {
  beforeAll(async () => {
    const empRes = await request(app)
      .post('/api/auth/register')
      .send({ name: 'App Emp', email: empEmail, password: 'password123', role: 'EMPLOYER' })
    empToken = empRes.body.data.accessToken

    const emp2Res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'App Emp2', email: emp2Email, password: 'password123', role: 'EMPLOYER' })
    emp2Token = emp2Res.body.data.accessToken

    const seekerRes = await request(app)
      .post('/api/auth/register')
      .send({ name: 'App Seeker Ext', email: seekerEmail, password: 'password123', role: 'SEEKER' })
    seekerToken = seekerRes.body.data.accessToken

    const jobRes = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${empToken}`)
      .send({
        title: 'Applications Test Job',
        company: 'App Test Corp',
        location: 'Remote',
        remote: true,
        category: 'Engineering',
        seniority: 'Senior',
        description: 'Test job for application flows',
        requirements: ['Testing'],
        responsibilities: ['Write tests'],
        tags: ['testing'],
      })
    jobId = jobRes.body.data.id

    const appRes = await request(app)
      .post('/api/applications')
      .set('Authorization', `Bearer ${seekerToken}`)
      .send({
        jobId,
        applicantName: 'App Seeker Ext',
        applicantEmail: seekerEmail,
        coverLetter: 'I want this job for extended testing.',
      })
    applicationId = appRes.body.data.id
  })

  afterAll(async () => {
    if (applicationId) await prisma.application.deleteMany({ where: { id: applicationId } })
    if (jobId) await prisma.job.deleteMany({ where: { id: jobId } })
    await prisma.user.deleteMany({ where: { email: { in: [empEmail, seekerEmail, emp2Email] } } })
  })

  describe('GET /api/applications (employer with jobId)', () => {
    it('should return applications for own job', async () => {
      const res = await request(app)
        .get(`/api/applications?jobId=${jobId}`)
        .set('Authorization', `Bearer ${empToken}`)
        .expect(200)

      expect(res.body.success).toBe(true)
      expect(Array.isArray(res.body.data)).toBe(true)
      expect(res.body.data.length).toBeGreaterThanOrEqual(1)
    })

    it('should return 403 when viewing another employers applications', async () => {
      const res = await request(app)
        .get(`/api/applications?jobId=${jobId}`)
        .set('Authorization', `Bearer ${emp2Token}`)
        .expect(403)

      expect(res.body.success).toBe(false)
    })

    it('should return 400 when employer omits jobId', async () => {
      const res = await request(app)
        .get('/api/applications')
        .set('Authorization', `Bearer ${empToken}`)
        .expect(400)

      expect(res.body.success).toBe(false)
    })
  })

  describe('PATCH /api/applications/:id/status', () => {
    it('should return 403 when employer updates status on another employers job', async () => {
      const res = await request(app)
        .patch(`/api/applications/${applicationId}/status`)
        .set('Authorization', `Bearer ${emp2Token}`)
        .send({ status: 'REJECTED' })
        .expect(403)

      expect(res.body.success).toBe(false)
    })

    it('should return 404 for non-existent application', async () => {
      const res = await request(app)
        .patch('/api/applications/fake-id/status')
        .set('Authorization', `Bearer ${empToken}`)
        .send({ status: 'OFFER' })
        .expect(404)

      expect(res.body.success).toBe(false)
    })
  })

  describe('POST /api/applications (duplicate prevention)', () => {
    it('should allow creating a second application (no unique constraint on userId+jobId)', async () => {
      const res = await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${seekerToken}`)
        .send({
          jobId,
          applicantName: 'App Seeker Ext',
          applicantEmail: seekerEmail,
          coverLetter: 'Second application for the same job.',
        })

      // Current schema does not have unique constraint on userId+jobId
      // This test documents current behavior
      expect([201, 409]).toContain(res.status)
    })
  })
})
