import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { prisma } from '../lib/prisma'
import { ApplicationsService } from '../modules/applications/applications.service'
import { sendApplicationStatusEmail, sendInterviewInviteEmail } from '../services/email'

vi.mock('../services/email', () => ({
  sendWelcomeEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
  sendApplicationStatusEmail: vi.fn().mockResolvedValue(undefined),
  sendInterviewInviteEmail: vi.fn().mockResolvedValue(undefined),
}))

const service = new ApplicationsService()
let jobId = ''
let applicationId = ''
const emails: string[] = []

describe('ApplicationsService email triggers', () => {
  beforeAll(async () => {
    const employerEmail = `email-trigger-emp-${Date.now()}@example.com`
    const seekerEmail = `email-trigger-seeker-${Date.now()}@example.com`
    emails.push(employerEmail, seekerEmail)
    const employer = await prisma.user.create({
      data: { name: 'Email Employer', email: employerEmail, passwordHash: 'x', role: 'EMPLOYER', companyName: 'Email Corp' },
    })
    const seeker = await prisma.user.create({
      data: { name: 'Email Seeker', email: seekerEmail, passwordHash: 'x', role: 'SEEKER' },
    })
    const job = await prisma.job.create({
      data: {
        title: 'Email Test Job',
        company: 'Email Corp',
        location: 'Remote',
        remote: true,
        category: 'Engineering',
        seniority: 'Junior',
        description: 'Test',
        requirements: ['Python'],
        responsibilities: ['Code'],
        tags: ['python'],
        employerId: employer.id,
      },
    })
    jobId = job.id
    const application = await prisma.application.create({
      data: {
        jobId,
        userId: seeker.id,
        applicantName: 'Email Seeker',
        applicantEmail: seekerEmail,
        coverLetter: 'Please consider me',
      },
    })
    applicationId = application.id
  }, 30_000)

  afterAll(async () => {
    await prisma.application.deleteMany({ where: { id: applicationId } })
    await prisma.job.deleteMany({ where: { id: jobId } })
    await prisma.user.deleteMany({ where: { email: { in: emails } } })
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('routes a transition to INTERVIEWING to sendInterviewInviteEmail with interviewData', async () => {
    await prisma.application.update({
      where: { id: applicationId },
      data: {
        interviewData: {
          interviewType: 'video',
          interviewDate: '2026-08-12',
          interviewTime: '10:00',
          interviewerName: 'Alice',
          interviewerTitle: 'CTO',
        },
      },
    })
    await service.updateStatus(applicationId, 'INTERVIEWING', 'any-user', 'ADMIN')
    expect(sendInterviewInviteEmail).toHaveBeenCalledTimes(1)
    expect(sendInterviewInviteEmail).toHaveBeenCalledWith(
      expect.stringContaining('@example.com'),
      'Email Seeker',
      'Email Test Job',
      'Email Corp',
      expect.objectContaining({ interviewType: 'video' }),
    )
    expect(sendApplicationStatusEmail).not.toHaveBeenCalled()
  })

  it('routes other transitions to sendApplicationStatusEmail with the company', async () => {
    await service.updateStatus(applicationId, 'SCREENING', 'any-user', 'ADMIN')
    expect(sendApplicationStatusEmail).toHaveBeenCalledTimes(1)
    expect(sendApplicationStatusEmail).toHaveBeenCalledWith(
      expect.stringContaining('@example.com'),
      'Email Seeker',
      'Email Test Job',
      'Email Corp',
      'SCREENING',
    )
    expect(sendInterviewInviteEmail).not.toHaveBeenCalled()
  })
})
