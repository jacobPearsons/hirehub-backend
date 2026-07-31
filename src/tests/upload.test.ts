import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import app from '../app/app'
import { prisma } from '../lib/prisma'

const seekerEmail = `test-upload-${Date.now()}@example.com`
const empEmail = `test-upload-emp-${Date.now()}@example.com`
let seekerToken = ''
let empToken = ''

beforeAll(async () => {
  const seekerRes = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Upload Seeker', email: seekerEmail, password: 'password123', role: 'SEEKER' })
  seekerToken = seekerRes.body.data.accessToken

  const empRes = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Upload Emp', email: empEmail, password: 'password123', role: 'EMPLOYER' })
  empToken = empRes.body.data.accessToken
})

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { in: [seekerEmail, empEmail] } } })
})

describe('Upload Routes', () => {
  describe('POST /api/upload/resume', () => {
    it('should upload a PDF resume', async () => {
      const res = await request(app)
        .post('/api/upload/resume')
        .set('Authorization', `Bearer ${seekerToken}`)
        .attach('resume', Buffer.from('PDF-1.4 fake pdf content'), {
          filename: 'resume.pdf',
          contentType: 'application/pdf',
        })
        .expect(200)

      expect(res.body.success).toBe(true)
      expect(res.body.data.resumePath).toBeDefined()
      expect(res.body.data.resumeFileName).toBe('resume.pdf')
    })

    it('should return 403 when employer tries to upload', async () => {
      await request(app)
        .post('/api/upload/resume')
        .set('Authorization', `Bearer ${empToken}`)
        .attach('resume', Buffer.from('PDF fake'), {
          filename: 'resume.pdf',
          contentType: 'application/pdf',
        })
        .expect(403)
    })

    it('should return 401 without auth', async () => {
      await request(app)
        .post('/api/upload/resume')
        .attach('resume', Buffer.from('PDF fake'), {
          filename: 'resume.pdf',
          contentType: 'application/pdf',
        })
        .expect(401)
    })
  })
})
