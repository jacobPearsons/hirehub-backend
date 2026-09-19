import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import app from '../app/app'
import { prisma } from '../lib/prisma'
import { grantJobPosting } from './helpers'

const employerEmail = `expiry-employer-${Date.now()}@example.com`
let employerToken = ''
const createdJobIds: string[] = []

const createJob = async (title: string) => {
  const res = await request(app)
    .post('/api/jobs')
    .set('Authorization', `Bearer ${employerToken}`)
    .send({
      title,
      company: 'Expiry Corp',
      location: 'Remote',
      remote: true,
      category: 'Engineering',
      seniority: 'Mid',
      description: 'd',
      requirements: [],
      responsibilities: [],
      tags: ['expiry'],
    })
    .expect(201)
  createdJobIds.push(res.body.data.id)
  return res.body.data
}

const forceExpire = async (id: string) => {
  await prisma.job.update({ where: { id }, data: { expiresAt: new Date(Date.now() - 1000) } })
}

describe('Job expiry', () => {
  beforeAll(async () => {
    const employerRes = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Expiry Employer', email: employerEmail, password: 'password123', role: 'EMPLOYER' })
    employerToken = employerRes.body.data.accessToken
    await grantJobPosting(employerEmail)
  })

  afterAll(async () => {
    await prisma.job.deleteMany({ where: { id: { in: createdJobIds } } })
    await prisma.user.deleteMany({ where: { email: employerEmail } })
  })

  it('creates a job with expiresAt ~14 days out', async () => {
    const created = await createJob(`Expiry Fresh ${Date.now()}`)

    expect(created.expiresAt).toBeTruthy()
    const delta = new Date(created.expiresAt).getTime() - new Date(created.postedDate ?? Date.now()).getTime()
    expect(Math.round(delta / 86400000)).toBe(14)
  })

  it('hides expired jobs from the public listing and search', async () => {
    const marker = `zzexpiry${Date.now()}`
    const fresh = await createJob(`Expiry Alive ${marker}`)
    const expired = await createJob(`Expiry Dead ${marker}`)
    await forceExpire(expired.id)

    const listRes = await request(app).get('/api/jobs').query({ sort: 'recent', take: '100' }).expect(200)
    const listIds = listRes.body.data.map((j: { id: string }) => j.id)
    expect(listIds).toContain(fresh.id)
    expect(listIds).not.toContain(expired.id)

    const searchRes = await request(app).get(`/api/jobs?search=${marker}`).expect(200)
    const searchIds = searchRes.body.data.map((j: { id: string }) => j.id)
    expect(searchIds).toContain(fresh.id)
    expect(searchIds).not.toContain(expired.id)
  })

  it('still returns expired jobs by id and to the owning employer', async () => {
    const expired = await createJob(`Expiry Owned ${Date.now()}`)
    await forceExpire(expired.id)

    const byId = await request(app).get(`/api/jobs/${expired.id}`).expect(200)
    expect(byId.body.data.id).toBe(expired.id)
    expect(new Date(byId.body.data.expiresAt).getTime()).toBeLessThan(Date.now())

    const mine = await request(app)
      .get('/api/jobs/employer/me')
      .set('Authorization', `Bearer ${employerToken}`)
      .expect(200)
    const mineIds = mine.body.data.map((j: { id: string }) => j.id)
    expect(mineIds).toContain(expired.id)
  })
})
