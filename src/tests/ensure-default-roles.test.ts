import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '../lib/prisma'
import { ensureDefaultRoles } from '../modules/rbac/ensure-default-roles'
import { DEFAULT_ROLES } from '../modules/rbac/default-roles'

const PRESERVE_ROLE_ID = 'test-self-heal-preserve'
const CREATE_ROLE_ID = 'test-self-heal-create'

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
