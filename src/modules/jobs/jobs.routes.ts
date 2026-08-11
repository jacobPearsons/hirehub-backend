import { Router } from 'express'
import { requireAuth, requireRole } from '../../middleware/auth'
import { validate } from '../../middleware/validate'
import { z } from 'zod'
import * as jobsController from './jobs.controller'

const router = Router()

const screeningQuestionSchema = z.object({
  prompt: z.string().min(1).max(500),
  expectedKeywords: z.array(z.string().max(50)).default([]),
  maxScore: z.number().int().min(1).max(100).default(5),
  order: z.number().int().min(0).optional(),
})

const createJobSchema = z.object({
  title: z.string().min(1).max(200),
  company: z.string().min(1).max(100),
  companyLogo: z.string().optional(),
  location: z.string().min(1).max(100),
  remote: z.boolean().optional(),
  salaryMin: z.number().optional(),
  salaryMax: z.number().optional(),
  currency: z.string().optional(),
  tags: z.array(z.string()).optional(),
  category: z.string().min(1).max(100),
  seniority: z.string().min(1).max(50),
  description: z.string().min(1).max(5000),
  requirements: z.array(z.string()).optional(),
  responsibilities: z.array(z.string()).optional(),
  featured: z.boolean().optional(),
  screeningQuestions: z.array(screeningQuestionSchema).optional(),
})

const updateJobSchema = createJobSchema.partial()

router.get('/jobs/tags/search', jobsController.searchTags)
router.get('/jobs/facets', jobsController.facets)
router.get('/jobs', jobsController.list)
router.get('/jobs/employer/me', requireAuth, requireRole('EMPLOYER'), jobsController.listByEmployer)
router.get('/jobs/:id', jobsController.getById)
router.post('/jobs', requireAuth, requireRole('EMPLOYER'), validate(createJobSchema), jobsController.create)
router.patch('/jobs/:id', requireAuth, requireRole('EMPLOYER'), validate(updateJobSchema), jobsController.update)
router.delete('/jobs/:id', requireAuth, requireRole('EMPLOYER'), jobsController.remove)

export default router
