import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import app from '../app/app'
import { prisma } from '../lib/prisma'

let employerToken = ''
let employerId = ''
let otherEmployerToken = ''
let seekerToken = ''
let seekerId = ''
let jobId = ''
let applicationId = ''
let conversationId = ''
const emails: string[] = []

async function register(name: string, role: string, prefix: string) {
  const email = `${prefix}-${Date.now()}@example.com`
  emails.push(email)
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name, email, password: 'password123', role })
  return { token: res.body.data.accessToken as string, userId: res.body.data.user.id as string }
}

describe('Hiring flow end-to-end', () => {
  beforeAll(async () => {
    const employer = await register('Flow Employer', 'EMPLOYER', 'flow-emp')
    employerToken = employer.token
    employerId = employer.userId
    const other = await register('Flow Other', 'EMPLOYER', 'flow-other')
    otherEmployerToken = other.token
    const seeker = await register('Flow Seeker', 'SEEKER', 'flow-seeker')
    seekerToken = seeker.token
    seekerId = seeker.userId

    const jobRes = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${employerToken}`)
      .send({
        title: 'Flow E2E Engineer',
        company: 'Flow Corp',
        location: 'Remote',
        remote: true,
        category: 'Engineering',
        seniority: 'Mid',
        description: 'Join the flow.',
        requirements: ['React', 'TypeScript'],
        responsibilities: ['Ship features'],
        tags: ['react'],
        screeningQuestions: [
          { prompt: 'How many years of React?', expectedKeywords: ['react', 'years'], maxScore: 5 },
          { prompt: 'Describe your testing approach', expectedKeywords: ['testing'], maxScore: 5 },
        ],
      })
      .expect(201)
    jobId = jobRes.body.data.id
    expect(jobRes.body.data.screeningQuestions).toHaveLength(2)
  }, 30_000)

  afterAll(async () => {
    if (conversationId) {
      await prisma.message.deleteMany({ where: { conversationId } })
      await prisma.conversation.deleteMany({ where: { id: conversationId } })
    }
    if (applicationId) {
      await prisma.application.deleteMany({ where: { id: applicationId } })
    }
    if (jobId) {
      await prisma.job.deleteMany({ where: { id: jobId } })
    }
    await prisma.user.deleteMany({ where: { email: { in: emails } } })
  })

  it('lets a seeker apply and get scored', async () => {
    const questions = await prisma.screeningQuestion.findMany({ where: { jobId }, orderBy: { order: 'asc' } })
    const res = await request(app)
      .post('/api/applications')
      .set('Authorization', `Bearer ${seekerToken}`)
      .send({
        jobId,
        applicantName: 'Flow Seeker',
        applicantEmail: emails[emails.length - 1],
        coverLetter: 'I build React applications with TypeScript and love testing.',
        screeningAnswers: [
          { questionId: questions[0].id, answerText: 'I have 4 years of React experience.' },
          { questionId: questions[1].id, answerText: 'I write unit and component tests for every feature.' },
        ],
      })
      .expect(201)
    applicationId = res.body.data.id
    expect(res.body.data.status).toBe('APPLIED')
    expect(res.body.data.screeningResult.score).toBeGreaterThan(0)
    expect(res.body.data.screeningAnswers[0].matchedKeywords).toContain('react')
    expect(res.body.data.timeline[0].toStatus).toBe('APPLIED')
  })

  it('shows the application to the owning employer', async () => {
    const res = await request(app)
      .get('/api/applications')
      .set('Authorization', `Bearer ${employerToken}`)
      .query({ jobId })
      .expect(200)
    const ids = res.body.data.map((a: { id: string }) => a.id)
    expect(ids).toContain(applicationId)
  })

  it('walks the application through the whole pipeline', async () => {
    for (const status of ['SCREENING', 'SHORTLIST', 'INTERVIEWING', 'OFFER', 'HIRED']) {
      const res = await request(app)
        .patch(`/api/applications/${applicationId}/status`)
        .set('Authorization', `Bearer ${employerToken}`)
        .send({ status })
        .expect(200)
      expect(res.body.data.status).toBe(status)
    }
  })

  it('records a timeline entry for each transition', async () => {
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      include: { timeline: { orderBy: { createdAt: 'asc' } } },
    })
    const statuses = application!.timeline.map((t) => t.toStatus)
    expect(statuses).toEqual(['APPLIED', 'SCREENING', 'SHORTLIST', 'INTERVIEWING', 'OFFER', 'HIRED'])
  })

  it('opens a website-chat interview with seeded questions', async () => {
    const res = await request(app)
      .post(`/api/applications/${applicationId}/interview-conversation`)
      .set('Authorization', `Bearer ${employerToken}`)
      .expect(201)
    conversationId = res.body.data.conversation.id
    expect(res.body.data.conversation.jobId).toBe(jobId)

    const messages = await request(app)
      .get(`/api/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${seekerToken}`)
      .expect(200)
    const contents = messages.body.data.map((m: { content: string }) => m.content)
    expect(contents[0]).toContain('Welcome to your HireHub interview')
    expect(contents).toContain('Q: How many years of React?')
    expect(contents).toContain('Q: Describe your testing approach')
  })

  it('supports two-way messages', async () => {
    await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${employerToken}`)
      .send({ conversationId, content: 'Are you available for a follow-up this week?' })
      .expect(201)
    await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${seekerToken}`)
      .send({ conversationId, content: 'Yes, mornings work best for me.' })
      .expect(201)

    const res = await request(app)
      .get(`/api/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${seekerToken}`)
      .expect(200)
    const contents = res.body.data.map((m: { content: string }) => m.content)
    const senders = res.body.data.map((m: { senderId: string }) => m.senderId)
    expect(contents).toContain('Are you available for a follow-up this week?')
    expect(contents).toContain('Yes, mornings work best for me.')
    expect(senders[senders.length - 1]).toBe(seekerId)
  })

  it('stores interview details for the candidate', async () => {
    const res = await request(app)
      .patch(`/api/applications/${applicationId}/hiring-data`)
      .set('Authorization', `Bearer ${employerToken}`)
      .send({
        interviewData: {
          interviewType: 'video',
          interviewDate: '2026-08-20',
          interviewTime: '10:00',
          interviewerName: 'Flow Manager',
          interviewerTitle: 'Head of Engineering',
          scheduledAt: new Date().toISOString(),
        },
      })
      .expect(200)
    expect(res.body.data.interviewData.interviewType).toBe('video')
  })

  it('enforces permission guards', async () => {
    await request(app)
      .patch(`/api/applications/${applicationId}/status`)
      .set('Authorization', `Bearer ${otherEmployerToken}`)
      .send({ status: 'OFFER' })
      .expect(403)

    await request(app)
      .patch(`/api/applications/${applicationId}/status`)
      .set('Authorization', `Bearer ${seekerToken}`)
      .send({ status: 'OFFER' })
      .expect(403)

    await request(app)
      .post(`/api/applications/${applicationId}/interview-conversation`)
      .set('Authorization', `Bearer ${seekerToken}`)
      .expect(403)

    await request(app)
      .patch(`/api/applications/${applicationId}/status`)
      .send({ status: 'OFFER' })
      .expect(401)
  })

  it('rejects illegal transitions', async () => {
    await request(app)
      .patch(`/api/applications/${applicationId}/status`)
      .set('Authorization', `Bearer ${employerToken}`)
      .send({ status: 'OFFER' })
      .expect(400)
  })
})
