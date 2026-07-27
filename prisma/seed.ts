import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const defaultRoles = [
  {
    id: 'admin',
    name: 'Administrator',
    description: 'Full system access with all capabilities',
    capabilities: ['*:*'],
  },
  {
    id: 'employer',
    name: 'Employer',
    description: 'Can manage job listings and review applications',
    capabilities: [
      'job:create', 'job:read', 'job:update', 'job:delete', 'job:list',
      'application:read', 'application:update', 'application:list',
      'user:read',
    ],
  },
  {
    id: 'seeker',
    name: 'Job Seeker',
    description: 'Can search jobs and submit applications',
    capabilities: [
      'job:read', 'job:list',
      'application:create', 'application:read', 'application:delete', 'application:list',
      'user:read', 'user:update',
    ],
  },
]

async function main() {
  console.log('Seeding roles...')

  for (const role of defaultRoles) {
    await prisma.role.upsert({
      where: { id: role.id },
      update: {
        name: role.name,
        description: role.description,
        capabilities: role.capabilities,
      },
      create: role,
    })
    console.log(`  ✓ ${role.id}: ${role.name}`)
  }

  console.log('Roles seeded.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
