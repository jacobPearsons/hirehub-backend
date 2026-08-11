import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import app from '../app/app'
import { prisma } from '../lib/prisma'

const employerEmail = `random-employer-${Date.now()}@example.com`
let token = ''
let seededIds: string[] = []

const RANDOM_JOB_SEEDS = [
  { title: 'Random Role Alpha', company: 'Acme', location: 'Austin, TX', remote: true, category: 'Engineering', seniority: 'senior', tags: ['alpha'], description: 'First random test job.', salaryMin: 100000, salaryMax: 120000 },
  { title: 'Random Role Bravo', company: 'Beta', location: 'Remote', remote: true, category: 'Engineering', seniority: 'mid', tags: ['bravo'], description: 'Second random test job.', salaryMin: 90000, salaryMax: 110000 },
  { title: 'Random Role Charlie', company: 'Gamma', location: 'Remote', remote: true, category: 'Design', seniority: 'mid', tags: ['charlie'], description: 'Third random test job.', salaryMin: 80000, salaryMax: 100000 },
  { title: 'Random Role Delta', company: 'Delta', location: 'Remote', remote: true, category: 'Design', seniority: 'junior', tags: ['delta'], description: 'Fourth random test job.', salaryMin: 70000, salaryMax: 90000 },
]

const SEARCH = 'Random Role'

async function seedJob(job: (typeof RANDOM_JOB_SEEDS)[number], employerId: string) {
  return prisma.job.create({
    data: {
      ...job,
      employer: { connect: { id: employerId } },
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      requirements: ['req'],
      responsibilities: ['resp'],
    },
  })
}

describe('GET /api/jobs random sort', () => {
  beforeAll(async () => {
    const reg = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Random Employer', email: employerEmail, password: 'password123', role: 'EMPLOYER' })
    token = reg.body.data.accessToken
    const user = await prisma.user.findUnique({ where: { email: employerEmail } })
    for (const job of RANDOM_JOB_SEEDS) {
      const created = await seedJob(job, user!.id)
      seededIds.push(created.id)
    }
  })

  afterAll(async () => {
    await prisma.job.deleteMany({ where: { id: { in: seededIds } } })
    await prisma.user.deleteMany({ where: { email: employerEmail } })
  })

  it('serves jobs by default with no sort param', async () => {
    const res = await request(app).get('/api/jobs').query({ take: '5' }).expect(200)
    expect(res.body.success).toBe(true)
    expect(Array.isArray(res.body.data)).toBe(true)
    expect(typeof res.body.pagination.total).toBe('number')
  })

  it('paginates random sort with a stable seeded cursor', async () => {
    const page1 = await request(app)
      .get('/api/jobs')
      .query({ search: SEARCH, sort: 'random', take: '2' })
      .expect(200)
    expect(page1.body.data.length).toBe(2)
    expect(page1.body.pagination.cursor).toBeTruthy()

    const page2 = await request(app)
      .get('/api/jobs')
      .query({ search: SEARCH, sort: 'random', take: '2', cursor: page1.body.pagination.cursor })
      .expect(200)
    expect(page2.body.data.length).toBe(2)
    expect(page2.body.pagination.cursor).toBeNull()

    const ids = [...page1.body.data, ...page2.body.data].map((j: any) => j.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.length).toBe(4)
    for (const id of ids) expect(seededIds).toContain(id)
  })

  it('replays the same cursor deterministically', async () => {
    const page1 = await request(app)
      .get('/api/jobs')
      .query({ search: SEARCH, sort: 'random', take: '2' })
      .expect(200)
    const page1Ids = page1.body.data.map((j: any) => j.id)

    const replay = await request(app)
      .get('/api/jobs')
      .query({ search: SEARCH, sort: 'random', take: '2', cursor: page1.body.pagination.cursor })
      .expect(200)
    const replayIds = replay.body.data.map((j: any) => j.id)

    const again = await request(app)
      .get('/api/jobs')
      .query({ search: SEARCH, sort: 'random', take: '2', cursor: page1.body.pagination.cursor })
      .expect(200)
    const againIds = again.body.data.map((j: any) => j.id)

    expect(againIds).toEqual(replayIds)
    for (const id of replayIds) expect(page1Ids).not.toContain(id)
  })

  it('omits the internal hash column from responses', async () => {
    const res = await request(app)
      .get('/api/jobs')
      .query({ search: SEARCH, sort: 'random', take: '2' })
      .expect(200)
    for (const job of res.body.data) expect(job).not.toHaveProperty('_hash')
  })
})
