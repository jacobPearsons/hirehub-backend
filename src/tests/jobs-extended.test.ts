import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import app from '../app/app'
import { prisma } from '../lib/prisma'

const emp1Email = `test-emp1-${Date.now()}@example.com`
const emp2Email = `test-emp2-${Date.now()}@example.com`
const seekerEmail = `test-seeker-ext-${Date.now()}@example.com`
let emp1Token = ''
let emp2Token = ''
let seekerToken = ''
let emp1JobId = ''
let emp2JobId = ''

const jobData = {
  title: 'Extended Test Job',
  company: 'Test Corp',
  location: 'Remote',
  remote: true,
  category: 'Engineering',
  seniority: 'Mid-Level',
  description: 'A test job for extended testing',
  requirements: ['TypeScript'],
  responsibilities: ['Write code'],
  tags: ['test'],
}

describe('Jobs Extended Routes', () => {
  beforeAll(async () => {
    const emp1Res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Emp1', email: emp1Email, password: 'password123', role: 'EMPLOYER' })
    emp1Token = emp1Res.body.data.accessToken

    const emp2Res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Emp2', email: emp2Email, password: 'password123', role: 'EMPLOYER' })
    emp2Token = emp2Res.body.data.accessToken

    const seekerRes = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Seeker Ext', email: seekerEmail, password: 'password123', role: 'SEEKER' })
    seekerToken = seekerRes.body.data.accessToken

    const job1Res = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${emp1Token}`)
      .send(jobData)
    emp1JobId = job1Res.body.data.id

    const job2Res = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${emp2Token}`)
      .send({ ...jobData, title: 'Emp2 Job' })
    emp2JobId = job2Res.body.data.id
  })

  afterAll(async () => {
    if (emp1JobId) await prisma.job.deleteMany({ where: { id: emp1JobId } })
    if (emp2JobId) await prisma.job.deleteMany({ where: { id: emp2JobId } })
    await prisma.user.deleteMany({ where: { email: { in: [emp1Email, emp2Email, seekerEmail] } } })
  })

  describe('PATCH /api/jobs/:id', () => {
    it('should update own job', async () => {
      const res = await request(app)
        .patch(`/api/jobs/${emp1JobId}`)
        .set('Authorization', `Bearer ${emp1Token}`)
        .send({ title: 'Updated Job Title' })
        .expect(200)

      expect(res.body.success).toBe(true)
      expect(res.body.data.title).toBe('Updated Job Title')
    })

    it('should return 403 when updating another employers job', async () => {
      const res = await request(app)
        .patch(`/api/jobs/${emp2JobId}`)
        .set('Authorization', `Bearer ${emp1Token}`)
        .send({ title: 'Hacked Title' })
        .expect(403)

      expect(res.body.success).toBe(false)
    })

    it('should return 403 when seeker tries to update', async () => {
      await request(app)
        .patch(`/api/jobs/${emp1JobId}`)
        .set('Authorization', `Bearer ${seekerToken}`)
        .send({ title: 'Nope' })
        .expect(403)
    })

    it('should return 404 for non-existent job', async () => {
      await request(app)
        .patch('/api/jobs/fake-id')
        .set('Authorization', `Bearer ${emp1Token}`)
        .send({ title: 'X' })
        .expect(404)
    })
  })

  describe('DELETE /api/jobs/:id', () => {
    it('should return 403 when deleting another employers job', async () => {
      await request(app)
        .delete(`/api/jobs/${emp2JobId}`)
        .set('Authorization', `Bearer ${emp1Token}`)
        .expect(403)
    })

    it('should return 403 when seeker tries to delete', async () => {
      await request(app)
        .delete(`/api/jobs/${emp1JobId}`)
        .set('Authorization', `Bearer ${seekerToken}`)
        .expect(403)
    })

    it('should delete own job', async () => {
      const jobRes = await request(app)
        .post('/api/jobs')
        .set('Authorization', `Bearer ${emp1Token}`)
        .send({ ...jobData, title: 'To Be Deleted' })
      const jobId = jobRes.body.data.id

      await request(app)
        .delete(`/api/jobs/${jobId}`)
        .set('Authorization', `Bearer ${emp1Token}`)
        .expect(204)

      await request(app)
        .get(`/api/jobs/${jobId}`)
        .expect(404)
    })
  })
})
