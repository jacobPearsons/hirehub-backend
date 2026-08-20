import { prisma } from '../../lib/prisma'
import { DEFAULT_ROLES, type DefaultRole } from './default-roles'

export async function ensureDefaultRoles(roles: DefaultRole[] = DEFAULT_ROLES): Promise<{ created: number }> {
  const existing = await prisma.role.findMany({
    where: { id: { in: roles.map((role) => role.id) } },
    select: { id: true },
  })
  const existingIds = new Set(existing.map((role) => role.id))
  const missing = roles.filter((role) => !existingIds.has(role.id))
  if (missing.length > 0) {
    await prisma.role.createMany({ data: missing })
  }
  return { created: missing.length }
}

export function defaultRoleForUserRole(userRole: string): string | null {
  if (userRole === 'ADMIN') return 'admin'
  if (userRole === 'EMPLOYER') return 'employer'
  if (userRole === 'SEEKER') return 'seeker'
  return null
}

export async function ensureDefaultRoleBindings(): Promise<{ created: number }> {
  await ensureDefaultRoles()

  const users = await prisma.user.findMany({
    where: { role: { in: ['ADMIN', 'EMPLOYER', 'SEEKER'] } },
    select: { id: true, role: true },
  })
  if (users.length === 0) return { created: 0 }

  const roleFor = new Map(users.map((u) => [u.id, defaultRoleForUserRole(u.role)]))

  const existing = await prisma.roleBinding.findMany({
    where: {
      userId: { in: users.map((u) => u.id) },
      roleId: { in: ['admin', 'employer', 'seeker'] },
      contextType: 'global',
      status: 'active',
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    select: { userId: true, roleId: true },
  })
  const hasBinding = new Set(existing.map((b) => `${b.userId}:${b.roleId}`))

  const toCreate = users
    .filter((u) => {
      const roleId = roleFor.get(u.id)
      return roleId !== null && !hasBinding.has(`${u.id}:${roleId}`)
    })
    .map((u) => ({
      userId: u.id,
      roleId: roleFor.get(u.id)!,
      contextType: 'global',
      status: 'active',
      grantedBy: u.id,
    }))

  if (toCreate.length === 0) return { created: 0 }

  const result = await prisma.roleBinding.createMany({ data: toCreate, skipDuplicates: true })
  return { created: result.count }
}
