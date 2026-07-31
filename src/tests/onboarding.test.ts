import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import app from '../app/app'
import { prisma } from '../lib/prisma'

const testEmail = `test-onboarding-${Date.now()}@example.com`
const employerEmail = `test-company-${Date.now()}@example.com`
const noCompanyEmployerEmail = `test-nocompany-${Date.now()}@example.com`
let accessToken = ''
let employerToken = ''
let noCompanyEmployerToken = ''

describe('Onboarding Wizard', () => {
  beforeAll(async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Onboarding User', email: testEmail, password: 'password123' })
    accessToken = res.body.data.accessToken

    const employerRes = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Company Owner', email: employerEmail, password: 'password123', role: 'EMPLOYER' })
    employerToken = employerRes.body.data.accessToken

    const noCompanyRes = await request(app)
      .post('/api/auth/register')
      .send({ name: 'No Company Owner', email: noCompanyEmployerEmail, password: 'password123', role: 'EMPLOYER' })
    noCompanyEmployerToken = noCompanyRes.body.data.accessToken
  })

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { in: [testEmail, employerEmail, noCompanyEmployerEmail] } },
    })
  })

  describe('PATCH /api/auth/profile onboarding fields', () => {
    it('should accept onboarding fields and reflect them in the response', async () => {
      const res = await request(app)
        .patch('/api/auth/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          headline: 'Senior Full-Stack Engineer',
          location: 'Lisbon, Portugal',
          skills: ['a', 'b', 'c'],
          remoteOnly: true,
          salaryMin: 60000,
          salaryMax: 90000,
          currency: 'USD',
          employmentType: 'Full-time',
        })
        .expect(200)

      expect(res.body.success).toBe(true)
      expect(res.body.data.headline).toBe('Senior Full-Stack Engineer')
      expect(res.body.data.location).toBe('Lisbon, Portugal')
      expect(res.body.data.skills).toEqual(['a', 'b', 'c'])
      expect(res.body.data.remoteOnly).toBe(true)
      expect(res.body.data.salaryMin).toBe(60000)
      expect(res.body.data.salaryMax).toBe(90000)
      expect(res.body.data.currency).toBe('USD')
      expect(res.body.data.employmentType).toBe('Full-time')
    })

    it('should reject an empty skills array', async () => {
      const res = await request(app)
        .patch('/api/auth/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ skills: [] })
        .expect(400)

      expect(res.body.success).toBe(false)
    })

    it('should reject more than 15 skills', async () => {
      const res = await request(app)
        .patch('/api/auth/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ skills: Array.from({ length: 16 }, (_, i) => `skill-${i}`) })
        .expect(400)

      expect(res.body.success).toBe(false)
    })

    it('should reject a negative salaryMin', async () => {
      const res = await request(app)
        .patch('/api/auth/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ salaryMin: -1 })
        .expect(400)

      expect(res.body.success).toBe(false)
    })

    it('should accept onboardingCompleted: true and return it', async () => {
      const res = await request(app)
        .patch('/api/auth/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ onboardingCompleted: true })
        .expect(200)

      expect(res.body.success).toBe(true)
      expect(res.body.data.onboardingCompleted).toBe(true)
    })
  })

  describe('Upload resume and serve it statically', () => {
    it('should upload a PDF resume and serve it back at its resumePath', async () => {
      const upload = await request(app)
        .post('/api/upload/resume')
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('resume', Buffer.from('PDF-1.4 fake pdf content'), {
          filename: 'resume.pdf',
          contentType: 'application/pdf',
        })
        .expect(200)

      expect(upload.body.success).toBe(true)
      expect(upload.body.data.resumePath).toBeDefined()
      expect(upload.body.data.resumePath).toMatch(/^\/uploads\/resumes\//)

      const served = await request(app).get(upload.body.data.resumePath).expect(200)

      expect(served.headers['content-type']).toContain('application/pdf')
    })
  })

  describe('Company logo upload', () => {
    beforeAll(async () => {
      await request(app)
        .put('/api/company')
        .set('Authorization', `Bearer ${employerToken}`)
        .send({ name: 'Test Company' })
        .expect(201)
    })

    it('should upload a PNG logo for the employer and serve it back at logoUrl', async () => {
      const upload = await request(app)
        .post('/api/company/logo')
        .set('Authorization', `Bearer ${employerToken}`)
        .attach('logo', Buffer.from('fake png content'), {
          filename: 'logo.png',
          contentType: 'image/png',
        })
        .expect(200)

      expect(upload.body.success).toBe(true)
      expect(upload.body.data.logoUrl).toBeDefined()
      expect(upload.body.data.logoUrl).toMatch(/^\/company-logos\//)

      const served = await request(app).get(upload.body.data.logoUrl).expect(200)
      expect(served.headers['content-type']).toContain('image/png')
    })

    it('should reject logo upload from a seeker', async () => {
      await request(app)
        .post('/api/company/logo')
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('logo', Buffer.from('fake png content'), {
          filename: 'logo.png',
          contentType: 'image/png',
        })
        .expect(403)
    })

    it('should reject a non-image file as logo', async () => {
      await request(app)
        .post('/api/company/logo')
        .set('Authorization', `Bearer ${employerToken}`)
        .attach('logo', Buffer.from('plain text content'), {
          filename: 'logo.txt',
          contentType: 'text/plain',
        })
        .expect(400)
    })
  })

  describe('Company team invites', () => {
    beforeAll(async () => {
      await request(app)
        .put('/api/company')
        .set('Authorization', `Bearer ${employerToken}`)
        .send({ name: 'Test Company' })
        .expect(201)
    })

    it('POST /api/company/invites persists invites with lowercased emails', async () => {
      const res = await request(app)
        .post('/api/company/invites')
        .set('Authorization', `Bearer ${employerToken}`)
        .send({ emails: ['a@x.com', 'B@x.com', 'c@x.com'] })
        .expect(201)

      expect(res.body.success).toBe(true)
      expect(res.body.data.invites).toHaveLength(3)
      const emails = res.body.data.invites.map((i: { email: string }) => i.email)
      expect(emails).toContain('a@x.com')
      expect(emails).toContain('b@x.com')
      expect(emails).toContain('c@x.com')
    })

    it('repeating an invite is idempotent', async () => {
      await request(app)
        .post('/api/company/invites')
        .set('Authorization', `Bearer ${employerToken}`)
        .send({ emails: ['a@x.com'] })
        .expect(201)

      const res = await request(app)
        .get('/api/company/invites')
        .set('Authorization', `Bearer ${employerToken}`)
        .expect(200)

      expect(res.body.data.invites).toHaveLength(3)
    })

    it('GET /api/company/invites returns invites newest-first', async () => {
      await request(app)
        .post('/api/company/invites')
        .set('Authorization', `Bearer ${employerToken}`)
        .send({ emails: ['d@x.com'] })
        .expect(201)

      const res = await request(app)
        .get('/api/company/invites')
        .set('Authorization', `Bearer ${employerToken}`)
        .expect(200)

      expect(res.body.success).toBe(true)
      expect(res.body.data.invites).toHaveLength(4)
      const invites = res.body.data.invites
      expect(invites[0].email).toBe('d@x.com')
      const createdAt = invites.map((i: { createdAt: string }) => new Date(i.createdAt).getTime())
      for (let i = 1; i < createdAt.length; i++) {
        expect(createdAt[i]).toBeLessThanOrEqual(createdAt[i - 1])
      }
    })

    it('POST with an invalid email returns 400', async () => {
      const res = await request(app)
        .post('/api/company/invites')
        .set('Authorization', `Bearer ${employerToken}`)
        .send({ emails: ['not-an-email'] })
        .expect(400)

      expect(res.body.success).toBe(false)
    })

    it('POST with 21 emails returns 400', async () => {
      const res = await request(app)
        .post('/api/company/invites')
        .set('Authorization', `Bearer ${employerToken}`)
        .send({ emails: Array.from({ length: 21 }, (_, i) => `member${i}@x.com`) })
        .expect(400)

      expect(res.body.success).toBe(false)
    })

    it('POST from an employer without a company returns 404', async () => {
      const res = await request(app)
        .post('/api/company/invites')
        .set('Authorization', `Bearer ${noCompanyEmployerToken}`)
        .send({ emails: ['a@x.com'] })
        .expect(404)

      expect(res.body.success).toBe(false)
    })

    it('POST from a seeker returns 403', async () => {
      await request(app)
        .post('/api/company/invites')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ emails: ['a@x.com'] })
        .expect(403)
    })
  })
})
