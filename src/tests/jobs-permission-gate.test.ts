import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import app from '../app/app'
import { prisma } from '../lib/prisma'
import { grantJobPosting } from './helpers'

const lockedEmail = `locked-emp-${Date.now()}@example.com`
const grantedEmail = `granted-emp-${Date.now()}@example.com`
let lockedToken = ''
let grantedToken = ''
let createdJobId = ''

const jobPayload = {
  title: 'Permission Gate Job',
  company: 'Gate Corp',
  location: 'Remote',
  remote: true,
  category: 'Engineering',
  seniority: 'Mid',
  description: 'Job for permission gate test',
  requirements: ['Typescript'],
  responsibilities: ['Code'],
  tags: ['gate'],
}

describe('Job posting permission gate', () => {
  beforeAll(async () => {
    const lockedRes = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Locked Employer', email: lockedEmail, password: 'password123', role: 'EMPLOYER' })
    lockedToken = lockedRes.body.data.accessToken

    const grantedRes = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Granted Employer', email: grantedEmail, password: 'password123', role: 'EMPLOYER' })
    grantedToken = grantedRes.body.data.accessToken
    await grantJobPosting(grantedEmail)
  })

  afterAll(async () => {
    if (createdJobId) await prisma.job.deleteMany({ where: { id: createdJobId } })
    await prisma.user.deleteMany({ where: { email: { in: [lockedEmail, grantedEmail] } } })
  })

  it('forbids a new employer from creating jobs until granted job:create', async () => {
    await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${lockedToken}`)
      .send(jobPayload)
      .expect(403)
  })

  it('allows an employer with a job-poster grant to create jobs', async () => {
    const res = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${grantedToken}`)
      .send(jobPayload)
      .expect(201)
    createdJobId = res.body.data.id
    expect(res.body.data.id).toBeDefined()
  })
})