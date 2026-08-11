import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '../lib/prisma'

describe('Screening + timeline models', () => {
  let employerId = ''
  let seekerId = ''
  let jobId = ''
  let applicationId = ''

  beforeAll(async () => {
    const employer = await prisma.user.create({
      data: { name: 'Smoke Employer', email: `smoke-emp-${Date.now()}@example.com`, passwordHash: 'x', role: 'EMPLOYER', companyName: 'Smoke Co' },
    })
    const seeker = await prisma.user.create({
      data: { name: 'Smoke Seeker', email: `smoke-seeker-${Date.now()}@example.com`, passwordHash: 'x', role: 'SEEKER' },
    })
    employerId = employer.id
    seekerId = seeker.id
    const job = await prisma.job.create({
      data: {
        title: 'Smoke Job', company: 'Smoke Co', location: 'Remote', remote: true,
        category: 'Engineering', seniority: 'Junior', description: 'Test',
        requirements: ['Python'], responsibilities: ['Code'], tags: ['python'],
        employerId: employer.id,
        screeningQuestions: { create: [{ prompt: 'Years of Python?', expectedKeywords: ['python'], maxScore: 10, order: 1 }] },
      },
      include: { screeningQuestions: true },
    })
    jobId = job.id
    const question = job.screeningQuestions[0]
    const application = await prisma.application.create({
      data: {
        jobId, userId: seeker.id, applicantName: 'Smoke Seeker', applicantEmail: `smoke-app-${Date.now()}@example.com`,
        coverLetter: 'I know python',
        screeningAnswers: { create: [{ questionId: question.id, answerText: '5 years python', score: 8, matchedKeywords: ['python'] }] },
        screeningResult: { create: { score: 8, maxPossible: 10 } },
        timeline: { create: { toStatus: 'APPLIED', actorRole: 'SEEKER' } },
      },
    })
    applicationId = application.id
  }, 30_000)

  afterAll(async () => {
    await prisma.application.deleteMany({ where: { id: applicationId } })
    await prisma.job.deleteMany({ where: { id: jobId } })
    await prisma.user.deleteMany({ where: { id: { in: [employerId, seekerId] } } })
  })

  it('persists questions, answers, result, and timeline with relations', async () => {
    const job = await prisma.job.findUnique({ where: { id: jobId }, include: { screeningQuestions: true } })
    expect(job?.screeningQuestions).toHaveLength(1)
    expect(job?.screeningQuestions[0].prompt).toBe('Years of Python?')

    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      include: { screeningAnswers: true, screeningResult: true, timeline: true },
    })
    expect(application?.screeningAnswers).toHaveLength(1)
    expect(application?.screeningAnswers[0].score).toBe(8)
    expect(application?.screeningResult?.score).toBe(8)
    expect(application?.timeline).toHaveLength(1)
    expect(application?.timeline[0].toStatus).toBe('APPLIED')
  })
})
