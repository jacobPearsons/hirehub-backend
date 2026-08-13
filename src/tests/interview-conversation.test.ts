import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import app from '../app/app'
import { prisma } from '../lib/prisma'
import { ApplicationsService } from '../modules/applications/applications.service'
import { AuthorizationError } from '../middleware/error-handler'

let employerToken = ''
let employerId = ''
let otherEmployerToken = ''
let otherEmployerId = ''
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

describe('Interview conversation endpoint', () => {
  const applicationsService = new ApplicationsService()

  beforeAll(async () => {
    const employer = await register('Interview Employer', 'EMPLOYER', 'iv-emp')
    employerToken = employer.token
    employerId = employer.userId
    const other = await register('Interview Other', 'EMPLOYER', 'iv-other')
    otherEmployerToken = other.token
    otherEmployerId = other.userId
    const seeker = await register('Interview Seeker', 'SEEKER', 'iv-seeker')
    seekerToken = seeker.token
    seekerId = seeker.userId

    const jobRes = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${employerToken}`)
      .send({
        title: 'Interview Test Job',
        company: 'Interview Corp',
        location: 'Remote',
        remote: true,
        category: 'Engineering',
        seniority: 'Junior',
        description: 'Test',
        requirements: ['Python'],
        responsibilities: ['Code'],
        tags: ['python'],
        screeningQuestions: [
          { prompt: 'Years of Python?', expectedKeywords: ['python'], maxScore: 10 },
          { prompt: 'Describe a tricky bug', expectedKeywords: [], maxScore: 5 },
        ],
      })
    jobId = jobRes.body.data.id

    const appRes = await request(app)
      .post('/api/applications')
      .set('Authorization', `Bearer ${seekerToken}`)
      .send({
        jobId,
        applicantName: 'Interview Seeker',
        applicantEmail: emails[emails.length - 1],
        coverLetter: 'Please consider me',
      })
    applicationId = appRes.body.data.id
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

  describe('ApplicationsService.openInterviewConversation', () => {
    it('creates a conversation with the employer and seeds an intro message', async () => {
      const result = await applicationsService.openInterviewConversation(applicationId, employerId)
      conversationId = result.conversation.id
      expect(result.conversation.jobId).toBe(jobId)
      expect(result.conversation.employerId).toBe(employerId)
      expect(result.conversation.candidateId).toBe(seekerId)

      const messages = await prisma.message.findMany({
        where: { conversationId: result.conversation.id },
        orderBy: { createdAt: 'asc' },
      })
      const contents = messages.map((m) => m.content)
      expect(messages.length).toBe(3)
      expect(messages[0].senderId).toBe(employerId)
      expect(contents[0]).toContain('HireHub interview')
      expect(contents[1]).toBe('Q: Years of Python?')
      expect(contents[2]).toBe('Q: Describe a tricky bug')
    })

    it('reuses an existing conversation instead of creating a duplicate', async () => {
      const first = await applicationsService.openInterviewConversation(applicationId, employerId)
      const countBefore = await prisma.message.count({ where: { conversationId: first.conversation.id } })
      const second = await applicationsService.openInterviewConversation(applicationId, employerId)
      const countAfter = await prisma.message.count({ where: { conversationId: second.conversation.id } })
      expect(first.conversation.id).toBe(second.conversation.id)
      expect(countAfter).toBe(countBefore)
    })

    it('throws AuthorizationError for a non-owning employer', async () => {
      await expect(
        applicationsService.openInterviewConversation(applicationId, otherEmployerId),
      ).rejects.toBeInstanceOf(AuthorizationError)
    })
  })

  describe('POST /api/applications/:id/interview-conversation', () => {
    it('creates a conversation with the employer and seeds an intro message', async () => {
      const res = await request(app)
        .post(`/api/applications/${applicationId}/interview-conversation`)
        .set('Authorization', `Bearer ${employerToken}`)
        .expect(201)

      expect(res.body.data.conversation.jobId).toBe(jobId)
      const messages = await request(app)
        .get(`/api/conversations/${res.body.data.conversation.id}/messages`)
        .set('Authorization', `Bearer ${seekerToken}`)
        .expect(200)
      expect(messages.body.data.length).toBeGreaterThan(0)
      expect(messages.body.data[0].content).toContain('HireHub interview')
      const contents = messages.body.data.map((m: { content: string }) => m.content)
      expect(contents).toContain('Q: Years of Python?')
      expect(contents).toContain('Q: Describe a tricky bug')
    })

    it('reuses an existing conversation instead of creating a duplicate', async () => {
      const first = await request(app)
        .post(`/api/applications/${applicationId}/interview-conversation`)
        .set('Authorization', `Bearer ${employerToken}`)
      const countBefore = await prisma.message.count({ where: { conversationId: first.body.data.conversation.id } })
      const second = await request(app)
        .post(`/api/applications/${applicationId}/interview-conversation`)
        .set('Authorization', `Bearer ${employerToken}`)
      const countAfter = await prisma.message.count({ where: { conversationId: second.body.data.conversation.id } })
      expect(first.body.data.conversation.id).toBe(second.body.data.conversation.id)
      expect(countAfter).toBe(countBefore)
    })

    it('forbids a non-owning EMPLOYER', async () => {
      await request(app)
        .post(`/api/applications/${applicationId}/interview-conversation`)
        .set('Authorization', `Bearer ${otherEmployerToken}`)
        .expect(403)
    })

    it('forbids a SEEKER', async () => {
      await request(app)
        .post(`/api/applications/${applicationId}/interview-conversation`)
        .set('Authorization', `Bearer ${seekerToken}`)
        .expect(403)
    })

    it('forbids unauthenticated requests', async () => {
      await request(app)
        .post(`/api/applications/${applicationId}/interview-conversation`)
        .expect(401)
    })
  })
})
