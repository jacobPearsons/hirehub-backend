import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import app from '../app/app'
import { prisma } from '../lib/prisma'

let adminToken = ''
const emails: string[] = []
const TEST_ROLE_ID = 'test-employer-permissions'

async function register(name: string, role: string, prefix: string) {
  const email = `${prefix}-${Date.now()}@example.com`
  emails.push(email)
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name, email, password: 'password123', role })
  return res.body.data.accessToken as string
}

describe('Auth responses expose effective permissions', () => {
  beforeAll(async () => {
    const adminEmail = `perm-admin-${Date.now()}@example.com`
    emails.push(adminEmail)
    await request(app)
      .post('/api/auth/register')
      .send({ name: 'Perm Admin', email: adminEmail, password: 'password123' })
    await prisma.user.update({ where: { email: adminEmail }, data: { role: 'ADMIN' } })
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: adminEmail, password: 'password123' })
    adminToken = loginRes.body.data.accessToken

    await prisma.role.upsert({
      where: { id: TEST_ROLE_ID },
      update: { capabilities: ['job:create', 'application:update'] },
      create: {
        id: TEST_ROLE_ID,
        name: 'Test Employer Permissions',
        description: '',
        capabilities: ['job:create', 'application:update'],
      },
    })
  }, 30_000)

  afterAll(async () => {
    await prisma.roleBinding.deleteMany({ where: { roleId: TEST_ROLE_ID } })
    await prisma.role.deleteMany({ where: { id: TEST_ROLE_ID } })
    await prisma.user.deleteMany({ where: { email: { in: emails } } })
  })

  it('exposes *:* for ADMIN on login', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: emails[0], password: 'password123' })
      .expect(200)
    expect(res.body.data.user.permissions).toContain('*:*')
  })

  it('exposes *:* for ADMIN via GET /auth/me', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)
    expect(res.body.data.permissions).toEqual(['*:*'])
  })

  it('returns binding capabilities for an EMPLOYER via GET /auth/me', async () => {
    const token = await register('Perm Employer', 'EMPLOYER', 'perm-emp')
    const email = emails[emails.length - 1]
    const user = await prisma.user.findUnique({ where: { email } })
    await prisma.roleBinding.create({
      data: { userId: user!.id, roleId: TEST_ROLE_ID, contextType: 'global' },
    })

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
    expect(res.body.data.permissions).toEqual(expect.arrayContaining(['job:create', 'application:update']))
  })

  it('locks job posting for a freshly-registered EMPLOYER (no job:create)', async () => {
    const token = await register('Perm Employer Default', 'EMPLOYER', 'perm-default')
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`).expect(200)
    expect(res.body.data.permissions).toEqual(expect.arrayContaining(['application:update']))
    expect(res.body.data.permissions).not.toContain('job:create')
  })
})
