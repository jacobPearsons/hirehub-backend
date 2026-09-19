export interface DefaultRole {
  id: string
  name: string
  description: string
  capabilities: string[]
}

/**
 * Grantable role that unlocks job posting. Not auto-bound on registration —
 * admins bind it to a specific employer to explicitly grant `job:create`.
 */
export const JOB_POSTER_ROLE: DefaultRole = {
  id: 'job-poster',
  name: 'Job Poster',
  description: 'Can create new job listings',
  capabilities: ['job:create'],
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
      'job:read', 'job:update', 'job:delete', 'job:list',
      'application:read', 'application:update', 'application:list',
      'company:create', 'company:read', 'company:update',
      'skill:read',
      'match:read',
      'user:read',
      'message:create', 'message:read',
      'notification:read',
    ],
  },
  {
    id: 'seeker',
    name: 'Job Seeker',
    description: 'Can search jobs and submit applications',
    capabilities: [
      'job:read', 'job:list',
      'application:create', 'application:read', 'application:delete', 'application:list',
      'skill:read',
      'match:read',
      'user:read', 'user:update',
      'message:create', 'message:read',
      'notification:read',
    ],
  },
]
