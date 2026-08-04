import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import app from '../app/app'
import { prisma } from '../lib/prisma'

let adminToken = ''
let employerToken = ''
let seekerToken = ''
const emails: string[] = []
const TEST_ROLE_ID = 'test-rbac-gating'

async function register(name: string, role: string, prefix: string) {
  const email = `${prefix}-${Date.now()}@example.com`
  emails.push(email)
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name, email, password: 'password123', role })
  return res.body.data.accessToken as string
}

describe('RBAC role read routes are ADMIN-only', () => {
  beforeAll(async () => {
    const adminEmail = `rbac-admin-${Date.now()}@example.com`
    emails.push(adminEmail)
    await request(app)
      .post('/api/auth/register')
      .send({ name: 'RBAC Admin', email: adminEmail, password: 'password123' })
    await prisma.user.update({ where: { email: adminEmail }, data: { role: 'ADMIN' } })
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: adminEmail, password: 'password123' })
    adminToken = loginRes.body.data.accessToken

    employerToken = await register('RBAC Employer', 'EMPLOYER', 'rbac-emp')
    seekerToken = await register('RBAC Seeker', 'SEEKER', 'rbac-seeker')

    await prisma.role.upsert({
      where: { id: TEST_ROLE_ID },
      update: { name: 'RBAC Gating Role' },
      create: { id: TEST_ROLE_ID, name: 'RBAC Gating Role', description: '', capabilities: ['job:read'] },
    })
  }, 30_000)

  afterAll(async () => {
    await prisma.role.deleteMany({ where: { id: TEST_ROLE_ID } })
    await prisma.user.deleteMany({ where: { email: { in: emails } } })
  })

  it('forbids unauthenticated GET /api/roles', async () => {
    await request(app).get('/api/roles').expect(401)
  })

  it('forbids SEEKER GET /api/roles', async () => {
    await request(app).get('/api/roles').set('Authorization', `Bearer ${seekerToken}`).expect(403)
  })

  it('forbids EMPLOYER GET /api/roles', async () => {
    await request(app).get('/api/roles').set('Authorization', `Bearer ${employerToken}`).expect(403)
  })

  it('allows ADMIN GET /api/roles', async () => {
    const res = await request(app).get('/api/roles').set('Authorization', `Bearer ${adminToken}`).expect(200)
    expect(Array.isArray(res.body.data)).toBe(true)
  })

  it('allows ADMIN GET /api/roles/:id', async () => {
    const res = await request(app)
      .get(`/api/roles/${TEST_ROLE_ID}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)
    expect(res.body.data).toHaveProperty('id', TEST_ROLE_ID)
  })

  it('forbids SEEKER GET /api/roles/:id', async () => {
    await request(app)
      .get(`/api/roles/${TEST_ROLE_ID}`)
      .set('Authorization', `Bearer ${seekerToken}`)
      .expect(403)
  })
})
