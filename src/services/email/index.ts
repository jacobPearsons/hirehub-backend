import { Resend } from 'resend'
import { env } from '../../config/env'
import { logger } from '../../config/logger'
import {
  renderInterviewInvite,
  renderPasswordReset,
  renderStatusEmail,
  renderWelcome,
  type InterviewDetailsData,
} from './templates'

export const SENDER = 'HireHub <onboarding@resend.dev>'

export interface SendEmailPayload {
  from: string
  to: string
  subject: string
  html: string
}

export interface EmailDeliverer {
  emails: { send: (payload: SendEmailPayload) => Promise<{ error?: unknown }> }
}

const resend: EmailDeliverer | null = env.RESEND_API_KEY
  ? (new Resend(env.RESEND_API_KEY) as unknown as EmailDeliverer)
  : null

export async function deliver(
  to: string,
  subject: string,
  html: string,
  client: EmailDeliverer | null = resend,
): Promise<void> {
  if (!client) {
    logger.info({ to, subject }, 'Email not sent — no RESEND_API_KEY')
    return
  }
  const { error } = await client.emails.send({
    from: SENDER,
    to,
    subject,
    html,
  })
  if (error) {
    logger.error({ error, to, subject }, 'Failed to send email')
  }
}

export async function sendWelcomeEmail(name: string, email: string): Promise<void> {
  const { subject, html } = renderWelcome(name)
  await deliver(email, subject, html)
}

export async function sendApplicationStatusEmail(
  applicantEmail: string,
  applicantName: string,
  jobTitle: string,
  company: string,
  status: string,
): Promise<void> {
  const { subject, html } = renderStatusEmail(applicantName, jobTitle, company, status)
  await deliver(applicantEmail, subject, html)
}

export async function sendInterviewInviteEmail(
  applicantEmail: string,
  applicantName: string,
  jobTitle: string,
  company: string,
  interviewData: unknown,
): Promise<void> {
  const { subject, html } = renderInterviewInvite(
    applicantName,
    jobTitle,
    company,
    interviewData as InterviewDetailsData | null | undefined,
  )
  await deliver(applicantEmail, subject, html)
}

export async function sendPasswordResetEmail(email: string, resetUrl: string): Promise<void> {
  const { subject, html } = renderPasswordReset(resetUrl)
  await deliver(email, subject, html)
}
