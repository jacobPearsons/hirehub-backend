import type { ApplicationStatus } from '@prisma/client'

export const ALLOWED_TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  APPLIED: ['SCREENING', 'SHORTLIST', 'REJECTED', 'WITHDRAWN'],
  SCREENING: ['SHORTLIST', 'INTERVIEWING', 'REJECTED', 'WITHDRAWN', 'APPLIED'],
  SHORTLIST: ['INTERVIEWING', 'OFFER', 'REJECTED', 'WITHDRAWN'],
  INTERVIEWING: ['OFFER', 'REJECTED', 'WITHDRAWN'],
  OFFER: ['HIRED', 'REJECTED', 'WITHDRAWN'],
  HIRED: [],
  REJECTED: [],
  WITHDRAWN: [],
}

export function canTransition(from: ApplicationStatus, to: ApplicationStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false
}
