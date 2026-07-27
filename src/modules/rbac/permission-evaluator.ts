import { prisma } from '../../lib/prisma'

interface PermissionResult {
  decision: 'ALLOW' | 'DENY'
  reason: string
  roleId?: string
}

export async function evaluatePermission(
  userId: string,
  action: string
): Promise<PermissionResult> {
  const bindings = await prisma.roleBinding.findMany({
    where: {
      userId,
      status: 'active',
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    },
    include: { role: true },
  })

  if (bindings.length === 0) {
    return { decision: 'DENY', reason: 'NO_BINDINGS' }
  }

  for (const binding of bindings) {
    const capabilities = binding.role.capabilities as string[]

    if (capabilities.includes('*:*')) {
      return { decision: 'ALLOW', reason: 'WILDCARD', roleId: binding.roleId }
    }

    if (capabilities.includes(action)) {
      return { decision: 'ALLOW', reason: 'EXACT_MATCH', roleId: binding.roleId }
    }

    const [resource] = action.split(':')
    if (capabilities.includes(`${resource}:*`)) {
      return { decision: 'ALLOW', reason: 'WILDCARD_ACTION', roleId: binding.roleId }
    }
  }

  return { decision: 'DENY', reason: 'NO_MATCHING_CAPABILITY' }
}
