import { Resend } from 'resend'
import { env } from '../config/env'
import { logger } from '../config/logger'

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null

export async function sendWelcomeEmail(name: string, email: string) {
  if (!resend) {
    logger.info({ email }, 'Welcome email (not sent — no RESEND_API_KEY)')
    return
  }

  const { error } = await resend.emails.send({
    from: 'HireHub <onboarding@resend.dev>',
    to: email,
    subject: 'Welcome to HireHub!',
    html: `
      <h2>Welcome to HireHub, ${name}!</h2>
      <p>Your account has been created successfully.</p>
      <p>Start browsing jobs or posting listings right away.</p>
      <a href="${env.APP_URL}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;">Get Started</a>
    `,
  })

  if (error) {
    logger.error({ error }, 'Failed to send welcome email')
  }
}

export async function sendApplicationStatusEmail(
  applicantEmail: string,
  applicantName: string,
  jobTitle: string,
  status: string,
) {
  if (!resend) {
    logger.info({ applicantEmail, status }, 'Status update email (not sent — no RESEND_API_KEY)')
    return
  }

  const statusLabels: Record<string, string> = {
    APPLIED: 'Received',
    REVIEWING: 'Under Review',
    INTERVIEWING: 'Interviewing',
    REJECTED: 'Not Selected',
    OFFER: 'Offer Extended',
  }

  const { error } = await resend.emails.send({
    from: 'HireHub <onboarding@resend.dev>',
    to: applicantEmail,
    subject: `Application status update: ${jobTitle}`,
    html: `
      <h2>Application Status Update</h2>
      <p>Hi ${applicantName},</p>
      <p>Your application for <strong>${jobTitle}</strong> has been updated to: <strong>${statusLabels[status] || status}</strong>.</p>
      <a href="${env.APP_URL}/dashboard" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;">View Dashboard</a>
    `,
  })

  if (error) {
    logger.error({ error }, 'Failed to send status update email')
  }
}

export async function sendPasswordResetEmail(email: string, resetUrl: string) {
  if (!resend) {
    logger.info({ email, resetUrl }, 'Password reset email (not sent — no RESEND_API_KEY)')
    return
  }

  const { error } = await resend.emails.send({
    from: 'HireHub <onboarding@resend.dev>',
    to: email,
    subject: 'Reset your HireHub password',
    html: `
      <h2>Reset your HireHub password</h2>
      <p>Click the link below to reset your password. This link expires in 1 hour.</p>
      <a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;">Reset Password</a>
      <p style="margin-top:24px;color:#666;">If you didn't request this, please ignore this email.</p>
    `,
  })

  if (error) {
    logger.error({ error }, 'Failed to send password reset email')
  }
}
