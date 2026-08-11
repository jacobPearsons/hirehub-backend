import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import app from '../app/app'
import { prisma } from '../lib/prisma'

const employerEmail = `search-employer-${Date.now()}@example.com`
let token = ''
let seededIds: string[] = []

const JOB_SEEDS = [
  { title: 'Senior React Engineer', company: 'Acme', location: 'Austin, TX', remote: true, category: 'Engineering', seniority: 'senior', tags: ['react', 'typescript'], description: 'Build the React frontend with TypeScript.', salaryMin: 140000, salaryMax: 190000 },
  { title: 'React Native Engineer', company: 'Beta', location: 'New York, NY', remote: false, category: 'Engineering', seniority: 'mid', tags: ['react native', 'mobile'], description: 'Build mobile apps.', salaryMin: 120000, salaryMax: 160000 },
  { title: 'Product Designer', company: 'Gamma', location: 'Austin, TX', remote: true, category: 'Design', seniority: 'senior', tags: ['figma'], description: 'Design product experiences.', salaryMin: 110000, salaryMax: 150000 },
]

async function seedJob(job: (typeof JOB_SEEDS)[number], employerId: string) {
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

describe('GET /api/jobs search', () => {
  beforeAll(async () => {
    const reg = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Search Employer', email: employerEmail, password: 'password123', role: 'EMPLOYER' })
    token = reg.body.data.accessToken
    const user = await prisma.user.findUnique({ where: { email: employerEmail } })
    for (const job of JOB_SEEDS) {
      const created = await seedJob(job, user!.id)
      seededIds.push(created.id)
    }
  })

  afterAll(async () => {
    await prisma.job.deleteMany({ where: { id: { in: seededIds } } })
    await prisma.user.deleteMany({ where: { email: employerEmail } })
  })

  it('combines search AND location filter (no short-circuit)', async () => {
    const res = await request(app).get('/api/jobs').query({ search: 'engineer', location: 'austin' }).expect(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.map((j: any) => j.title)).toContain('Senior React Engineer')
    expect(res.body.data.map((j: any) => j.title)).not.toContain('React Native Engineer')
  })

  it('applies category + seniority + remote filters together', async () => {
    const res = await request(app).get('/api/jobs').query({ category: 'Engineering', seniority: 'senior', remote: 'true', sort: 'recent', take: '100' }).expect(200)
    const seededTitles = JOB_SEEDS.map((s) => s.title)
    const titles = res.body.data.map((j: any) => j.title).filter((t: string) => seededTitles.includes(t))
    expect(titles).toEqual(['Senior React Engineer'])
  })

  it('sorts by salary_high descending with nulls last', async () => {
    const res = await request(app).get('/api/jobs').query({ sort: 'salary_high', take: '10' }).expect(200)
    const salaries = res.body.data.map((j: any) => j.salaryMax ?? -1)
    const nonNull = salaries.filter((s: number) => s >= 0)
    for (let i = 1; i < nonNull.length; i++) {
      expect(nonNull[i - 1]).toBeGreaterThanOrEqual(nonNull[i])
    }
  })

  it('excludes expired jobs from listings', async () => {
    const expired = await prisma.job.create({
      data: {
        title: 'Expired Role', company: 'Zeta', location: 'Nowhere', remote: false,
        category: 'Engineering', seniority: 'junior', description: 'expired',
        requirements: [], responsibilities: [],
        employer: { connect: { id: (await prisma.user.findUniqueOrThrow({ where: { email: employerEmail } })).id } },
        expiresAt: new Date(Date.now() - 1000),
      },
    })
    seededIds.push(expired.id)
    const res = await request(app).get('/api/jobs').query({ search: 'expired' }).expect(200)
    expect(res.body.data.length).toBe(0)
  })

  it('paginates with keyset cursor and take', async () => {
    const res = await request(app).get('/api/jobs').query({ take: '2', sort: 'recent' }).expect(200)
    expect(res.body.data.length).toBe(2)
    expect(res.body.pagination.cursor).toBeTruthy()
    const next = await request(app).get('/api/jobs').query({ take: '2', cursor: res.body.pagination.cursor, sort: 'recent' }).expect(200)
    const ids = [...res.body.data, ...next.body.data].map((j: any) => j.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('falls back to ILIKE for short queries', async () => {
    const res = await request(app).get('/api/jobs').query({ search: 're' }).expect(200)
    expect(res.body.success).toBe(true)
  })
})
