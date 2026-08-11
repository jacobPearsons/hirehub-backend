import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import app from '../app/app'
import { prisma } from '../lib/prisma'

let employerToken = ''
let seekerToken = ''
let jobId = ''
let applicationId = ''
let withdrawApplicationId = ''
let jobQuestions: { id: string }[] = []
const emails: string[] = []

async function register(name: string, role: 'EMPLOYER' | 'SEEKER') {
  const email = `pipeline-${role.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`
  emails.push(email)
  const res = await request(app).post('/api/auth/register').send({ name, email, password: 'password123', role })
  return res.body.data.accessToken as string
}

describe('Screening + ATS pipeline', () => {
  beforeAll(async () => {
    employerToken = await register('Pipeline Employer', 'EMPLOYER')
    seekerToken = await register('Pipeline Seeker', 'SEEKER')
    const jobRes = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${employerToken}`)
      .send({
        title: 'Pipeline Job', company: 'Pipeline Co', location: 'Remote', remote: true,
        category: 'Engineering', seniority: 'Junior', description: 'Test',
        requirements: ['Python'], responsibilities: ['Code'], tags: ['python'],
        screeningQuestions: [
          { prompt: 'Years of Python?', expectedKeywords: ['python'], maxScore: 10 },
          { prompt: 'FastAPI?', expectedKeywords: ['fastapi'], maxScore: 5 },
        ],
      })
      .expect(201)
    jobId = jobRes.body.data.id
    jobQuestions = jobRes.body.data.screeningQuestions
  }, 30_000)

  afterAll(async () => {
    if (applicationId) await prisma.application.deleteMany({ where: { id: applicationId } })
    if (withdrawApplicationId) await prisma.application.deleteMany({ where: { id: withdrawApplicationId } })
    if (jobId) await prisma.job.deleteMany({ where: { id: jobId } })
    await prisma.user.deleteMany({ where: { email: { in: emails } } })
  })

  it('scores a screening application at submit time', async () => {
    const res = await request(app)
      .post('/api/applications')
      .set('Authorization', `Bearer ${seekerToken}`)
      .send({
        jobId,
        applicantName: 'Pipeline Seeker',
        applicantEmail: emails[1],
        coverLetter: 'I build APIs with Python',
        screeningAnswers: [
          { questionId: jobQuestions[0].id, answerText: 'Five years of python' },
          { questionId: jobQuestions[1].id, answerText: 'I have used FastAPI in production' },
        ],
      })
      .expect(201)

    applicationId = res.body.data.id
    expect(res.body.data.status).toBe('APPLIED')
    expect(res.body.data.screeningResult.score).toBe(16) // cover 'python' (1) + 10 + 5
    expect(res.body.data.screeningResult.maxPossible).toBe(17) // 2 keyword rows (requirements+tags) + 15
    expect(res.body.data.screeningAnswers).toHaveLength(2)
  })

  it('moves an application through the full legal pipeline', async () => {
    const steps = ['SCREENING', 'SHORTLIST', 'INTERVIEWING', 'OFFER', 'HIRED']
    for (const next of steps) {
      const res = await request(app)
        .patch(`/api/applications/${applicationId}/status`)
        .set('Authorization', `Bearer ${employerToken}`)
        .send({ status: next })
        .expect(200)
      expect(res.body.data.status).toBe(next)
    }
  })

  it('rejects illegal transitions with 400', async () => {
    const res = await request(app)
      .patch(`/api/applications/${applicationId}/status`)
      .set('Authorization', `Bearer ${employerToken}`)
      .send({ status: 'OFFER' }) // HIRED -> OFFER illegal
      .expect(400)
    expect(res.body.success).toBe(false)
  })

  it('returns the application with timeline and screening details to the owning employer', async () => {
    const res = await request(app)
      .get(`/api/applications/${applicationId}`)
      .set('Authorization', `Bearer ${employerToken}`)
      .expect(200)

    expect(res.body.data.status).toBe('HIRED')
    expect(res.body.data.timeline.length).toBeGreaterThanOrEqual(6) // APPLIED + 5 transitions
    expect(res.body.data.timeline[0].toStatus).toBe('APPLIED')
    expect(res.body.data.screeningResult.score).toBe(16)
    expect(res.body.data.screeningAnswers[0].question.prompt).toBe('Years of Python?')
  })

  it('forbids a non-owner seeker from viewing another application', async () => {
    const other = await request(app).post('/api/auth/register')
      .send({ name: 'Other Seeker', email: `other-${Date.now()}@example.com`, password: 'password123', role: 'SEEKER' })
    emails.push(other.body.data.user.email)
    await request(app)
      .get(`/api/applications/${applicationId}`)
      .set('Authorization', `Bearer ${other.body.data.accessToken}`)
      .expect(403)
  })

  it('lets a seeker withdraw a non-terminal application', async () => {
    const createRes = await request(app)
      .post('/api/applications')
      .set('Authorization', `Bearer ${seekerToken}`)
      .send({
        jobId,
        applicantName: 'Pipeline Seeker',
        applicantEmail: emails[1],
        coverLetter: 'I build APIs with Python',
        screeningAnswers: [
          { questionId: jobQuestions[0].id, answerText: 'Five years of python' },
          { questionId: jobQuestions[1].id, answerText: 'I have used FastAPI in production' },
        ],
      })
      .expect(201)
    withdrawApplicationId = createRes.body.data.id

    const res = await request(app)
      .post(`/api/applications/${withdrawApplicationId}/withdraw`)
      .set('Authorization', `Bearer ${seekerToken}`)
      .expect(200)
    expect(res.body.data.status).toBe('WITHDRAWN')

    const again = await request(app)
      .post(`/api/applications/${withdrawApplicationId}/withdraw`)
      .set('Authorization', `Bearer ${seekerToken}`)
      .expect(400)
    expect(again.body.success).toBe(false)
  })
})
