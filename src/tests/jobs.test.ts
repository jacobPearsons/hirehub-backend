import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import app from '../app/app'
import { prisma } from '../lib/prisma'
import { grantJobPosting } from './helpers'

const employerEmail = `test-employer-${Date.now()}@example.com`
const seekerEmail = `test-seeker-${Date.now()}@example.com`
let employerToken = ''
let seekerToken = ''
let createdJobId = ''

describe('Jobs Routes', () => {
  beforeAll(async () => {
    const employerRes = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Test Employer', email: employerEmail, password: 'password123', role: 'EMPLOYER' })
    employerToken = employerRes.body.data.accessToken
    await grantJobPosting(employerEmail)

    const seekerRes = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Test Seeker', email: seekerEmail, password: 'password123', role: 'SEEKER' })
    seekerToken = seekerRes.body.data.accessToken
  })

  afterAll(async () => {
    if (createdJobId) {
      await prisma.job.deleteMany({ where: { id: createdJobId } })
    }
    await prisma.user.deleteMany({ where: { email: { in: [employerEmail, seekerEmail] } } })
  })

  describe('GET /api/jobs', () => {
    it('should return paginated job list', async () => {
      const res = await request(app).get('/api/jobs').expect(200)

      expect(res.body.success).toBe(true)
      expect(Array.isArray(res.body.data)).toBe(true)
    })
  })

  describe('POST /api/jobs', () => {
    it('should create a job when employer', async () => {
      const res = await request(app)
        .post('/api/jobs')
        .set('Authorization', `Bearer ${employerToken}`)
        .send({
          title: 'Test Job - Software Engineer',
          company: 'Test Corp',
          location: 'San Francisco',
          remote: true,
          category: 'Engineering',
          seniority: 'Mid-Level',
          description: 'Test description',
          requirements: ['React', 'Node.js'],
          responsibilities: ['Build features', 'Write tests'],
          tags: ['react', 'node'],
        })
        .expect(201)

      expect(res.body.success).toBe(true)
      expect(res.body.data.id).toBeDefined()
      createdJobId = res.body.data.id
    })

    it('should return 403 when seeker tries to create job', async () => {
      const res = await request(app)
        .post('/api/jobs')
        .set('Authorization', `Bearer ${seekerToken}`)
        .send({
          title: 'Test Job Unauthorized',
          company: 'Test',
          location: 'Remote',
          category: 'Engineering',
          seniority: 'Senior',
          description: 'Should fail',
          requirements: ['X'],
          responsibilities: ['Y'],
          tags: ['z'],
        })
        .expect(403)

      expect(res.body.success).toBe(false)
    })
  })

  describe('GET /api/jobs/:id', () => {
    it('should return 404 for non-existent job', async () => {
      const res = await request(app).get('/api/jobs/nonexistent-id').expect(404)

      expect(res.body.success).toBe(false)
    })

    it('should return job by id', async () => {
      if (!createdJobId) return
      const res = await request(app).get(`/api/jobs/${createdJobId}`).expect(200)

      expect(res.body.success).toBe(true)
      expect(res.body.data.title).toBe('Test Job - Software Engineer')
    })
  })
})
