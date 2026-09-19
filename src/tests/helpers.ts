import { prisma } from '../lib/prisma'
import { JOB_POSTER_ROLE } from '../modules/rbac/default-roles'

/**
 * Grants `job:create` to an employer by binding the `job-poster` role.
 * Mirrors what an admin does via the Grant Role flow. Safe to call
 * repeatedly (idempotent via skipDuplicates).
 */
export async function grantJobPosting(employerEmail: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email: employerEmail } })
  if (!user) throw new Error(`grantJobPosting: no user with email ${employerEmail}`)

  const role = await prisma.role.upsert({
    where: { id: JOB_POSTER_ROLE.id },
    update: {},
    create: JOB_POSTER_ROLE,
  })

  await prisma.roleBinding.createMany({
    data: [
      {
        userId: user.id,
        roleId: role.id,
        contextType: 'global',
        status: 'active',
        grantedBy: user.id,
      },
    ],
    skipDuplicates: true,
  })
}