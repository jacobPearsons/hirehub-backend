export const DEMO_EMAIL_PATTERN = /^demo\.candidate\d+@hirehub\.community$/

export const DEMO_CANDIDATE_EMAILS = [
  'demo.candidate1@hirehub.community',
  'demo.candidate2@hirehub.community',
  'demo.candidate3@hirehub.community',
  'demo.candidate4@hirehub.community',
  'demo.candidate5@hirehub.community',
] as const

export const DEMO_COMPANY = 'HireHub'

export function isDemoCandidateEmail(email: string): boolean {
  return DEMO_EMAIL_PATTERN.test(email)
}
