import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import app from '../app/app'
import { prisma } from '../lib/prisma'

const seekerEmail = `test-saved-seeker-${Date.now()}@example.com`
const empEmail = `test-saved-emp-${Date.now()}@example.com`
let seekerToken = ''
let empToken = ''
let jobId = ''

describe('Saved Jobs Routes', () => {
  beforeAll(async () => {
    const seekerRes = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Saved Seeker', email: seekerEmail, password: 'password123', role: 'SEEKER' })
    seekerToken = seekerRes.body.data.accessToken

    const empRes = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Saved Emp', email: empEmail, password: 'password123', role: 'EMPLOYER' })
    empToken = empRes.body.data.accessToken

    const jobRes = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${empToken}`)
      .send({
        title: 'Saved Jobs Test',
        company: 'Save Corp',
        location: 'Remote',
        remote: true,
        category: 'Engineering',
        seniority: 'Junior',
        description: 'Job for save testing',
        requirements: ['Saving'],
        responsibilities: ['Save things'],
        tags: ['save'],
      })
    jobId = jobRes.body.data.id
  })

  afterAll(async () => {
    await prisma.savedJob.deleteMany({ where: { user: { email: seekerEmail } } })
    await prisma.job.deleteMany({ where: { id: jobId } })
    await prisma.user.deleteMany({ where: { email: { in: [seekerEmail, empEmail] } } })
  })

  describe('POST /api/saved-jobs', () => {
    it('should save a job when seeker', async () => {
      const res = await request(app)
        .post('/api/saved-jobs')
        .set('Authorization', `Bearer ${seekerToken}`)
        .send({ jobId })
        .expect(201)

      expect(res.body.success).toBe(true)
      expect(res.body.data.jobId).toBe(jobId)
    })

    it('should be idempotent (upsert)', async () => {
      const res = await request(app)
        .post('/api/saved-jobs')
        .set('Authorization', `Bearer ${seekerToken}`)
        .send({ jobId })
        .expect(201)

      expect(res.body.success).toBe(true)
    })

    it('should return 403 when employer tries to save', async () => {
      await request(app)
        .post('/api/saved-jobs')
        .set('Authorization', `Bearer ${empToken}`)
        .send({ jobId })
        .expect(403)
    })

    it('should return 400 with invalid jobId', async () => {
      await request(app)
        .post('/api/saved-jobs')
        .set('Authorization', `Bearer ${seekerToken}`)
        .send({ jobId: '' })
        .expect(400)
    })

    it('should return 404 with non-existent jobId', async () => {
      await request(app)
        .post('/api/saved-jobs')
        .set('Authorization', `Bearer ${seekerToken}`)
        .send({ jobId: 'nonexistent-id' })
        .expect(404)
    })
  })

  describe('GET /api/saved-jobs', () => {
    it('should list saved jobs with job data', async () => {
      const res = await request(app)
        .get('/api/saved-jobs')
        .set('Authorization', `Bearer ${seekerToken}`)
        .expect(200)

      expect(res.body.success).toBe(true)
      expect(Array.isArray(res.body.data)).toBe(true)
      expect(res.body.data.length).toBeGreaterThanOrEqual(1)
      expect(res.body.data[0].job).toBeDefined()
    })

    it('should return 403 when employer tries to list', async () => {
      await request(app)
        .get('/api/saved-jobs')
        .set('Authorization', `Bearer ${empToken}`)
        .expect(403)
    })
  })

  describe('DELETE /api/saved-jobs/:jobId', () => {
    it('should unsave a job', async () => {
      await request(app)
        .delete(`/api/saved-jobs/${jobId}`)
        .set('Authorization', `Bearer ${seekerToken}`)
        .expect(204)

      const res = await request(app)
        .get('/api/saved-jobs')
        .set('Authorization', `Bearer ${seekerToken}`)
        .expect(200)

      const saved = res.body.data.find((s: any) => s.jobId === jobId)
      expect(saved).toBeUndefined()
    })

    it('should return 403 when employer tries to unsave', async () => {
      await request(app)
        .delete(`/api/saved-jobs/${jobId}`)
        .set('Authorization', `Bearer ${empToken}`)
        .expect(403)
    })
  })
})
