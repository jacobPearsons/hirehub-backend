import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import app from '../app/app'
import { prisma } from '../lib/prisma'

let employerToken = ''
let employerEmail = ''
let jobId = ''

describe('Jobs screening questions API', () => {
  beforeAll(async () => {
    employerEmail = `jobscreen-emp-${Date.now()}@example.com`
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'JobScreen Employer', email: employerEmail, password: 'password123', role: 'EMPLOYER' })
    employerToken = res.body.data.accessToken
  })

  afterAll(async () => {
    if (jobId) await prisma.job.deleteMany({ where: { id: jobId } })
    await prisma.user.deleteMany({ where: { email: employerEmail } })
  })

  it('creates a job with screening questions, auto-assigning order', async () => {
    const res = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${employerToken}`)
      .send({
        title: 'Screening Job', company: 'Scr Co', location: 'Remote', remote: true,
        category: 'Engineering', seniority: 'Junior', description: 'Test',
        requirements: ['Python'], responsibilities: ['Code'], tags: ['python'],
        screeningQuestions: [
          { prompt: 'Years of Python?', expectedKeywords: ['python'], maxScore: 10 },
          { prompt: 'Describe a tricky bug', expectedKeywords: [], maxScore: 5 },
        ],
      })
      .expect(201)

    expect(res.body.data.screeningQuestions).toHaveLength(2)
    expect(res.body.data.screeningQuestions[0].order).toBe(1)
    expect(res.body.data.screeningQuestions[1].order).toBe(2)
    jobId = res.body.data.id
  })

  it('replaces screening questions on update', async () => {
    const res = await request(app)
      .patch(`/api/jobs/${jobId}`)
      .set('Authorization', `Bearer ${employerToken}`)
      .send({
        screeningQuestions: [
          { prompt: 'Only one now', expectedKeywords: ['one'], maxScore: 3 },
        ],
      })
      .expect(200)

    expect(res.body.data.screeningQuestions).toHaveLength(1)
    expect(res.body.data.screeningQuestions[0].prompt).toBe('Only one now')
    expect(res.body.data.screeningQuestions[0].order).toBe(1)
  })

  it('rejects screening questions with an empty prompt', async () => {
    const res = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${employerToken}`)
      .send({
        title: 'Bad Question Job', company: 'Scr Co', location: 'Remote', remote: true,
        category: 'Engineering', seniority: 'Junior', description: 'Test',
        requirements: ['Python'], responsibilities: ['Code'], tags: ['python'],
        screeningQuestions: [{ prompt: '', expectedKeywords: ['x'], maxScore: 5 }],
      })
      .expect(400)
    expect(res.body.success).toBe(false)
  })
})
