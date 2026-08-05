export interface DefaultRole {
  id: string
  name: string
  description: string
  capabilities: string[]
}

export const DEFAULT_ROLES: DefaultRole[] = [
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
