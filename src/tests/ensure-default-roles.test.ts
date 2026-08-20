import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '../lib/prisma'
import { ensureDefaultRoles, ensureDefaultRoleBindings } from '../modules/rbac/ensure-default-roles'
import { DEFAULT_ROLES } from '../modules/rbac/default-roles'

const PRESERVE_ROLE_ID = 'test-self-heal-preserve'
const CREATE_ROLE_ID = 'test-self-heal-create'
const LEGACY_EMPLOYER_EMAIL = 'test-legacy-employer@example.com'
const LEGACY_SEEKER_EMAIL = 'test-legacy-seeker@example.com'
const LEGACY_ADMIN_EMAIL = 'test-legacy-admin@example.com'

describe('ensureDefaultRoles', () => {
  beforeAll(async () => {
    await ensureDefaultRoles()
  })

  afterAll(async () => {
    await prisma.role.deleteMany({
      where: { id: { in: [PRESERVE_ROLE_ID, CREATE_ROLE_ID] } },
    })
  })

  it('ensures the canonical admin/employer/seeker roles exist', async () => {
    const roles = await prisma.role.findMany({
      where: { id: { in: DEFAULT_ROLES.map((r) => r.id) } },
    })
    expect(roles.map((r) => r.id).sort()).toEqual(['admin', 'employer', 'seeker'])
  })

  it('creates a missing role without overwriting the rest', async () => {
    const result = await ensureDefaultRoles([
      {
        id: CREATE_ROLE_ID,
        name: 'Self Heal Create',
        description: 'created by test',
        capabilities: ['job:read'],
      },
    ])
    expect(result.created).toBe(1)

    const created = await prisma.role.findUnique({ where: { id: CREATE_ROLE_ID } })
    expect(created).not.toBeNull()
    expect(created?.capabilities).toEqual(['job:read'])
  })

  it('preserves an existing role and its capabilities', async () => {
    await prisma.role.create({
      data: {
        id: PRESERVE_ROLE_ID,
        name: 'Self Heal Preserve',
        description: 'existing',
        capabilities: ['custom:keep'],
      },
    })

    const result = await ensureDefaultRoles([
      {
        id: PRESERVE_ROLE_ID,
        name: 'Should Not Change',
        description: 'should not apply',
        capabilities: ['custom:overwrite'],
      },
    ])
    expect(result.created).toBe(0)

    const preserved = await prisma.role.findUnique({ where: { id: PRESERVE_ROLE_ID } })
    expect(preserved?.name).toBe('Self Heal Preserve')
    expect(preserved?.capabilities).toEqual(['custom:keep'])
  })
})

describe('ensureDefaultRoleBindings', () => {
  let legacyEmployerId: string
  let legacySeekerId: string
  let legacyAdminId: string

  beforeAll(async () => {
    await ensureDefaultRoles()
  })

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { in: [LEGACY_EMPLOYER_EMAIL, LEGACY_SEEKER_EMAIL, LEGACY_ADMIN_EMAIL] } },
    })
  })

  it('heals users without a default role binding', async () => {
    const employer = await prisma.user.create({
      data: { name: 'Legacy Employer', email: LEGACY_EMPLOYER_EMAIL, passwordHash: 'x', role: 'EMPLOYER' },
    })
    const seeker = await prisma.user.create({
      data: { name: 'Legacy Seeker', email: LEGACY_SEEKER_EMAIL, passwordHash: 'x', role: 'SEEKER' },
    })
    const admin = await prisma.user.create({
      data: { name: 'Legacy Admin', email: LEGACY_ADMIN_EMAIL, passwordHash: 'x', role: 'ADMIN' },
    })
    legacyEmployerId = employer.id
    legacySeekerId = seeker.id
    legacyAdminId = admin.id

    const before = await prisma.roleBinding.count({
      where: { userId: { in: [employer.id, seeker.id, admin.id] } },
    })
    expect(before).toBe(0)

    const result = await ensureDefaultRoleBindings()

    const employerBinding = await prisma.roleBinding.findFirst({
      where: { userId: employer.id, roleId: 'employer', contextType: 'global', status: 'active' },
    })
    const seekerBinding = await prisma.roleBinding.findFirst({
      where: { userId: seeker.id, roleId: 'seeker', contextType: 'global', status: 'active' },
    })
    const adminBinding = await prisma.roleBinding.findFirst({
      where: { userId: admin.id, roleId: 'admin', contextType: 'global', status: 'active' },
    })
    expect(employerBinding).not.toBeNull()
    expect(seekerBinding).not.toBeNull()
    expect(adminBinding).not.toBeNull()
    expect(result.created).toBeGreaterThanOrEqual(3)
  })

  it('is idempotent and never duplicates existing bindings', async () => {
    const beforeEmployer = await prisma.roleBinding.count({
      where: { userId: legacyEmployerId, roleId: 'employer', contextType: 'global' },
    })
    const beforeSeeker = await prisma.roleBinding.count({
      where: { userId: legacySeekerId, roleId: 'seeker', contextType: 'global' },
    })
    const beforeAdmin = await prisma.roleBinding.count({
      where: { userId: legacyAdminId, roleId: 'admin', contextType: 'global' },
    })
    await ensureDefaultRoleBindings()
    const afterEmployer = await prisma.roleBinding.count({
      where: { userId: legacyEmployerId, roleId: 'employer', contextType: 'global' },
    })
    const afterSeeker = await prisma.roleBinding.count({
      where: { userId: legacySeekerId, roleId: 'seeker', contextType: 'global' },
    })
    const afterAdmin = await prisma.roleBinding.count({
      where: { userId: legacyAdminId, roleId: 'admin', contextType: 'global' },
    })
    expect(afterEmployer).toBe(beforeEmployer)
    expect(afterSeeker).toBe(beforeSeeker)
    expect(afterAdmin).toBe(beforeAdmin)
  })

  it('leaves users who already hold their default binding untouched', async () => {
    const before = await prisma.roleBinding.count({ where: { userId: legacyEmployerId } })
    await ensureDefaultRoleBindings()
    const after = await prisma.roleBinding.count({ where: { userId: legacyEmployerId } })
    expect(after).toBe(before)
  })
})
