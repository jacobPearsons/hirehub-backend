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
