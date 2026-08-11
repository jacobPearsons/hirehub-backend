import { describe, it, expect, afterAll } from 'vitest'
import request from 'supertest'
import app from '../app/app'
import { prisma } from '../lib/prisma'

describe('RBAC auto-binding on registration', () => {
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { contains: 'autobind' } } })
  })

  it('binds a freshly-registered EMPLOYER to the default employer role', async () => {
    const email = `autobind-emp-${Date.now()}@example.com`
    await request(app)
      .post('/api/auth/register')
      .send({ name: 'AutoBind Employer', email, password: 'password123', role: 'EMPLOYER' })
      .expect(201)

    const user = await prisma.user.findUnique({ where: { email } })
    expect(user).not.toBeNull()
    const binding = await prisma.roleBinding.findFirst({ where: { userId: user!.id, roleId: 'employer' } })
    expect(binding).not.toBeNull()
    expect(binding!.contextType).toBe('global')
  })

  it('binds a freshly-registered SEEKER to the default seeker role', async () => {
    const email = `autobind-seeker-${Date.now()}@example.com`
    await request(app)
      .post('/api/auth/register')
      .send({ name: 'AutoBind Seeker', email, password: 'password123', role: 'SEEKER' })
      .expect(201)

    const user = await prisma.user.findUnique({ where: { email } })
    expect(user).not.toBeNull()
    const binding = await prisma.roleBinding.findFirst({ where: { userId: user!.id, roleId: 'seeker' } })
    expect(binding).not.toBeNull()
  })
})
