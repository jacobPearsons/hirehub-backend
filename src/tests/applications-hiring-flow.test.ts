import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import app from '../app/app'
import { prisma } from '../lib/prisma'

let adminToken = ''
let employerToken = ''
let otherEmployerToken = ''
let seekerToken = ''
let createdJobId = ''
let createdApplicationId = ''
const emails: string[] = []

async function register(name: string, role: string, prefix: string) {
  const email = `${prefix}-${Date.now()}@example.com`
  emails.push(email)
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name, email, password: 'password123', role })
  return res.body.data.accessToken as string
}

describe('Applications hiring-flow access', () => {
  beforeAll(async () => {
    const adminEmail = `flow-admin-${Date.now()}@example.com`
    emails.push(adminEmail)
    await request(app)
      .post('/api/auth/register')
      .send({ name: 'Flow Admin', email: adminEmail, password: 'password123' })
    await prisma.user.update({ where: { email: adminEmail }, data: { role: 'ADMIN' } })
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: adminEmail, password: 'password123' })
    adminToken = loginRes.body.data.accessToken

    employerToken = await register('Flow Employer', 'EMPLOYER', 'flow-emp')
    otherEmployerToken = await register('Flow Other', 'EMPLOYER', 'flow-other')
    seekerToken = await register('Flow Seeker', 'SEEKER', 'flow-seeker')

    const jobRes = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${employerToken}`)
      .send({
        title: 'Flow Test Job',
        company: 'Flow Corp',
        location: 'Remote',
        remote: true,
        category: 'Engineering',
        seniority: 'Junior',
        description: 'Test',
        requirements: ['Python'],
        responsibilities: ['Code'],
        tags: ['python'],
      })
    createdJobId = jobRes.body.data.id

    const appRes = await request(app)
      .post('/api/applications')
      .set('Authorization', `Bearer ${seekerToken}`)
      .send({
        jobId: createdJobId,
        applicantName: 'Flow Seeker',
        applicantEmail: emails[emails.length - 1],
        coverLetter: 'Please consider me',
      })
    createdApplicationId = appRes.body.data.id
  }, 30_000)

  afterAll(async () => {
    if (createdApplicationId) {
      await prisma.application.deleteMany({ where: { id: createdApplicationId } })
    }
    if (createdJobId) {
      await prisma.job.deleteMany({ where: { id: createdJobId } })
    }
    await prisma.user.deleteMany({ where: { email: { in: emails } } })
  })

  describe('PATCH /api/applications/:id/status', () => {
    it('allows ADMIN to update status', async () => {
      const res = await request(app)
        .patch(`/api/applications/${createdApplicationId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'SCREENING' })
        .expect(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data.status).toBe('SCREENING')
    })

    it('allows the owning EMPLOYER to update status', async () => {
      const res = await request(app)
        .patch(`/api/applications/${createdApplicationId}/status`)
        .set('Authorization', `Bearer ${employerToken}`)
        .send({ status: 'INTERVIEWING' })
        .expect(200)
      expect(res.body.data.status).toBe('INTERVIEWING')
    })

    it('forbids non-owning EMPLOYER', async () => {
      await request(app)
        .patch(`/api/applications/${createdApplicationId}/status`)
        .set('Authorization', `Bearer ${otherEmployerToken}`)
        .send({ status: 'REJECTED' })
        .expect(403)
    })

    it('forbids SEEKER', async () => {
      await request(app)
        .patch(`/api/applications/${createdApplicationId}/status`)
        .set('Authorization', `Bearer ${seekerToken}`)
        .send({ status: 'REJECTED' })
        .expect(403)
    })

    it('forbids unauthenticated requests', async () => {
      await request(app)
        .patch(`/api/applications/${createdApplicationId}/status`)
        .send({ status: 'REJECTED' })
        .expect(401)
    })
  })

  describe('PATCH /api/applications/:id/hiring-data', () => {
    const hiringData = {
      interviewData: { date: '2026-09-01T10:00:00.000Z', type: 'video', location: 'Remote' },
    }

    it('allows ADMIN to update hiring data', async () => {
      const res = await request(app)
        .patch(`/api/applications/${createdApplicationId}/hiring-data`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(hiringData)
        .expect(200)
      expect(res.body.success).toBe(true)
    })

    it('allows the owning EMPLOYER to update hiring data', async () => {
      const res = await request(app)
        .patch(`/api/applications/${createdApplicationId}/hiring-data`)
        .set('Authorization', `Bearer ${employerToken}`)
        .send(hiringData)
        .expect(200)
      expect(res.body.data.interviewData).toBeDefined()
    })

    it('forbids a non-owning EMPLOYER', async () => {
      await request(app)
        .patch(`/api/applications/${createdApplicationId}/hiring-data`)
        .set('Authorization', `Bearer ${otherEmployerToken}`)
        .send(hiringData)
        .expect(403)
    })

    it('allows a SEEKER to update their own hiring data', async () => {
      const res = await request(app)
        .patch(`/api/applications/${createdApplicationId}/hiring-data`)
        .set('Authorization', `Bearer ${seekerToken}`)
        .send(hiringData)
        .expect(200)
      expect(res.body.success).toBe(true)
    })

    it('forbids unauthenticated requests', async () => {
      await request(app)
        .patch(`/api/applications/${createdApplicationId}/hiring-data`)
        .send(hiringData)
        .expect(401)
    })
  })

  describe('GET /api/applications/:id/candidate', () => {
    it('returns the candidate profile for ADMIN', async () => {
      const res = await request(app)
        .get(`/api/applications/${createdApplicationId}/candidate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data.candidate).toHaveProperty('id')
      expect(res.body.data.candidate.email).toBe(emails[emails.length - 1])
      expect(res.body.data.candidate).toHaveProperty('skills')
      expect(res.body.data.candidate).toHaveProperty('resumePath')
      expect(res.body.data.candidate.passwordHash).toBeUndefined()
      expect(res.body.data.application.id).toBe(createdApplicationId)
    })

    it('returns the candidate profile for the owning EMPLOYER', async () => {
      const res = await request(app)
        .get(`/api/applications/${createdApplicationId}/candidate`)
        .set('Authorization', `Bearer ${employerToken}`)
        .expect(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data.candidate.email).toBe(emails[emails.length - 1])
    })

    it('forbids a non-owning EMPLOYER', async () => {
      await request(app)
        .get(`/api/applications/${createdApplicationId}/candidate`)
        .set('Authorization', `Bearer ${otherEmployerToken}`)
        .expect(403)
    })

    it('forbids SEEKER', async () => {
      await request(app)
        .get(`/api/applications/${createdApplicationId}/candidate`)
        .set('Authorization', `Bearer ${seekerToken}`)
        .expect(403)
    })

    it('returns 404 for a missing application', async () => {
      await request(app)
        .get('/api/applications/nonexistent-id/candidate')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404)
    })

    it('forbids unauthenticated requests', async () => {
      await request(app)
        .get(`/api/applications/${createdApplicationId}/candidate`)
        .expect(401)
    })
  })

  describe('Applications granted employer (application:update)', () => {
    const TEST_ROLE_ID = 'test-employer-applications'
    let grantedToken = ''
    let grantedOtherToken = ''
    let grantedSeekerToken = ''
    let grantedJobId = ''
    let grantedApplicationId = ''
    const grantedEmails: string[] = []

    async function registerWithId(name: string, role: string, prefix: string) {
      const token = await register(name, role, prefix)
      const email = emails[emails.length - 1]
      grantedEmails.push(email)
      const user = await prisma.user.findUnique({ where: { email } })
      return { token, userId: user!.id }
    }

    beforeAll(async () => {
      await prisma.role.upsert({
        where: { id: TEST_ROLE_ID },
        update: { capabilities: ['application:update'] },
        create: {
          id: TEST_ROLE_ID,
          name: 'Test Employer (Applications)',
          description: '',
          capabilities: ['application:update'],
        },
      })

      const owner = await registerWithId('Granted Owner', 'EMPLOYER', 'granted-owner')
      const other = await registerWithId('Granted Other', 'EMPLOYER', 'granted-other')
      const seeker = await registerWithId('Granted Seeker', 'SEEKER', 'granted-seeker')
      grantedToken = owner.token
      grantedOtherToken = other.token
      grantedSeekerToken = seeker.token

      await prisma.roleBinding.createMany({
        data: [
          { userId: owner.userId, roleId: TEST_ROLE_ID, contextType: 'global' },
          { userId: other.userId, roleId: TEST_ROLE_ID, contextType: 'global' },
        ],
      })

      const jobRes = await request(app)
        .post('/api/jobs')
        .set('Authorization', `Bearer ${grantedToken}`)
        .send({
          title: 'Granted Test Job',
          company: 'Granted Corp',
          location: 'Remote',
          remote: true,
          category: 'Engineering',
          seniority: 'Junior',
          description: 'Test',
          requirements: ['Python'],
          responsibilities: ['Code'],
          tags: ['python'],
        })
      grantedJobId = jobRes.body.data.id

      const appRes = await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${grantedSeekerToken}`)
        .send({
          jobId: grantedJobId,
          applicantName: 'Granted Seeker',
          applicantEmail: emails[emails.length - 1],
          coverLetter: 'Please consider me',
        })
      grantedApplicationId = appRes.body.data.id
    }, 30_000)

    afterAll(async () => {
      await prisma.application.deleteMany({ where: { id: grantedApplicationId } })
      await prisma.job.deleteMany({ where: { id: grantedJobId } })
      await prisma.roleBinding.deleteMany({ where: { roleId: TEST_ROLE_ID } })
      await prisma.role.deleteMany({ where: { id: TEST_ROLE_ID } })
      await prisma.user.deleteMany({ where: { email: { in: grantedEmails } } })
    })

    it('allows the owning granted EMPLOYER to update status', async () => {
      const res = await request(app)
        .patch(`/api/applications/${grantedApplicationId}/status`)
        .set('Authorization', `Bearer ${grantedToken}`)
        .send({ status: 'INTERVIEWING' })
        .expect(200)
      expect(res.body.data.status).toBe('INTERVIEWING')
    })

    it('allows the owning granted EMPLOYER to update hiring data', async () => {
      await request(app)
        .patch(`/api/applications/${grantedApplicationId}/hiring-data`)
        .set('Authorization', `Bearer ${grantedToken}`)
        .send({ interviewData: { date: '2026-09-01T10:00:00.000Z', type: 'video', location: 'Remote' } })
        .expect(200)
    })

    it('forbids a granted EMPLOYER who does not own the job from updating status', async () => {
      await request(app)
        .patch(`/api/applications/${grantedApplicationId}/status`)
        .set('Authorization', `Bearer ${grantedOtherToken}`)
        .send({ status: 'REJECTED' })
        .expect(403)
    })
  })
})
