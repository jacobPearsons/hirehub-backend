import { env } from '../../config/env'
import { escapeHtml, renderLayout, type Cta } from './template'

export interface EmailContent {
  subject: string
  html: string
}

export interface InterviewDetailsData {
  interviewType?: string | null
  interviewDate?: string | null
  interviewTime?: string | null
  interviewerName?: string | null
  interviewerTitle?: string | null
  meetingLink?: string | null
  meetingLocation?: string | null
}

const DASHBOARD_URL = `${env.APP_URL}/dashboard`

const INTERVIEW_TYPE_LABELS: Record<string, string> = {
  phone: 'Phone call',
  video: 'Video call',
  'in-person': 'In person',
}

function formatInterviewDate(date: string): string | null {
  const [year, month, day] = date.split('-').map(Number)
  if (!year || !month || !day) return null
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  const dt = new Date(year, month - 1, day)
  if (dt.getFullYear() !== year || dt.getMonth() !== month - 1 || dt.getDate() !== day) return null
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(dt)
}

function formatInterviewTime(time: string): string | null {
  const [hour, minute] = time.split(':').map(Number)
  if (hour === undefined || minute === undefined || Number.isNaN(hour) || Number.isNaN(minute)) return null
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null
  const dt = new Date(2000, 0, 1, hour, minute)
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(dt)
}

function safeHref(value: string | null | undefined): string | null {
  if (!value) return null
  return value.startsWith('http://') || value.startsWith('https://') ? value : null
}

export function renderWelcome(name: string): EmailContent {
  const cta: Cta = { label: 'Browse Jobs', href: env.APP_URL }
  const body = `
      <p style="margin:0 0 16px;">Hi ${escapeHtml(name)},</p>
      <p style="margin:0 0 16px;">Welcome to HireHub! Your account is ready. Browse jobs, save your favorites, and apply in minutes.</p>`
  return {
    subject: 'Welcome to HireHub!',
    html: renderLayout(body, cta, `Welcome to HireHub, ${escapeHtml(name)}`),
  }
}

const STATUS_COPY: Record<
  string,
  { headline: string; body: (jobTitle: string, company: string) => string; ctaLabel: string; ctaHref: string }
> = {
  APPLIED: {
    headline: 'Application received',
    body: (jobTitle, company) =>
      `Your application for <strong>${escapeHtml(jobTitle)}</strong> at <strong>${escapeHtml(company)}</strong> has been received and is now in the employer's hands.`,
    ctaLabel: 'View Application',
    ctaHref: DASHBOARD_URL,
  },
  SCREENING: {
    headline: 'Application under screening',
    body: (jobTitle, company) =>
      `Good news — your application for <strong>${escapeHtml(jobTitle)}</strong> at <strong>${escapeHtml(company)}</strong> is under screening. We'll let you know as soon as there's an update.`,
    ctaLabel: 'View Dashboard',
    ctaHref: DASHBOARD_URL,
  },
  OFFER: {
    headline: 'You received an offer',
    body: (jobTitle, company) =>
      `Congratulations! You've received an offer for <strong>${escapeHtml(jobTitle)}</strong> at <strong>${escapeHtml(company)}</strong>. Head to your dashboard to review the details and respond.`,
    ctaLabel: 'Review Offer',
    ctaHref: DASHBOARD_URL,
  },
  REJECTED: {
    headline: 'Application not selected',
    body: (jobTitle, company) =>
      `Thank you for applying to <strong>${escapeHtml(jobTitle)}</strong> at <strong>${escapeHtml(company)}</strong>. After careful review, the employer decided not to move forward with your application this time. Many more opportunities are waiting on HireHub.`,
    ctaLabel: 'Browse Jobs',
    ctaHref: env.APP_URL,
  },
}

export function renderStatusEmail(name: string, jobTitle: string, company: string, status: string): EmailContent {
  const copy = STATUS_COPY[status] ?? {
    headline: 'Application status update',
    body: (jobTitle: string, company: string) =>
      `Your application for <strong>${escapeHtml(jobTitle)}</strong> at <strong>${escapeHtml(company)}</strong> is now: ${escapeHtml(status)}.`,
    ctaLabel: 'View Dashboard',
    ctaHref: DASHBOARD_URL,
  }
  const body = `
      <p style="margin:0 0 16px;">Hi ${escapeHtml(name)},</p>
      <p style="margin:0 0 16px;">${copy.body(jobTitle, company)}</p>`
  return {
    subject: `Application status update: ${jobTitle}`,
    html: renderLayout(body, { label: copy.ctaLabel, href: copy.ctaHref }, copy.headline),
  }
}

export function renderInterviewInvite(
  name: string,
  jobTitle: string,
  company: string,
  interviewData?: InterviewDetailsData | null,
): EmailContent {
  const details = interviewData ?? {}

  const dateLabel = details.interviewDate ? formatInterviewDate(details.interviewDate) : null
  const timeLabel = details.interviewTime ? formatInterviewTime(details.interviewTime) : null
  const typeLabel = details.interviewType
    ? INTERVIEW_TYPE_LABELS[details.interviewType] ?? escapeHtml(details.interviewType)
    : null
  const locationLabel = details.meetingLocation ? escapeHtml(details.meetingLocation) : null
  const meetingHref = safeHref(details.meetingLink)
  const interviewerLabel = details.interviewerName
    ? details.interviewerTitle
      ? `${escapeHtml(details.interviewerName)} (${escapeHtml(details.interviewerTitle)})`
      : escapeHtml(details.interviewerName)
    : null

  const hasSchedule = Boolean(dateLabel && timeLabel)

  let body: string
  if (hasSchedule) {
    const detailRow = (label: string, value: string) =>
      `<tr>
        <td style="padding:6px 0;padding-right:16px;color:#9ca3af;white-space:nowrap;font-size:14px;">${label}</td>
        <td style="padding:6px 0;font-size:14px;">${value}</td>
      </tr>`

    const rows: string[] = []
    if (dateLabel) rows.push(detailRow('Date', dateLabel))
    if (timeLabel) rows.push(detailRow('Time', timeLabel))
    if (typeLabel) rows.push(detailRow('Type', typeLabel))
    if (locationLabel) rows.push(detailRow('Where', locationLabel))
    else if (meetingHref) {
      rows.push(
        detailRow('Where', `<a href="${escapeHtml(meetingHref)}" style="color:#2563eb;">${escapeHtml(details.meetingLink ?? '')}</a>`),
      )
    }
    if (interviewerLabel) rows.push(detailRow('Interviewer', interviewerLabel))

    const detailsHtml = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0;">${rows.join('\n')}</table>`

    body = `
      <p style="margin:0 0 16px;">Hi ${escapeHtml(name)},</p>
      <p style="margin:0 0 16px;">Good news! The team at <strong>${escapeHtml(company)}</strong> would like to invite you to an interview for <strong>${escapeHtml(jobTitle)}</strong>. Here are the details:</p>
      ${detailsHtml}
      <p style="margin:16px 0 0;">Please confirm your availability in your dashboard.</p>`
  } else {
    body = `
      <p style="margin:0 0 16px;">Hi ${escapeHtml(name)},</p>
      <p style="margin:0 0 16px;">Good news! The team at <strong>${escapeHtml(company)}</strong> would like to invite you to interview for <strong>${escapeHtml(jobTitle)}</strong>. The employer is finalizing the schedule — keep an eye on your dashboard for the interview details.</p>`
  }

  return {
    subject: `Interview invitation: ${jobTitle} at ${company}`,
    html: renderLayout(body, { label: 'View Interview Details', href: DASHBOARD_URL }, 'Interview invitation'),
  }
}

export function renderPasswordReset(resetUrl: string): EmailContent {
  const body = `
      <p style="margin:0 0 16px;">We received a request to reset your HireHub password. Click the button below to choose a new one. This link expires in 1 hour.</p>
      <p style="margin:0 0 16px;">If you didn't request this, you can safely ignore this email.</p>`
  return {
    subject: 'Reset your HireHub password',
    html: renderLayout(body, { label: 'Reset Password', href: resetUrl }, 'Reset your HireHub password'),
  }
}
