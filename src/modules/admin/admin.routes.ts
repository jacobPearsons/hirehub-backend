import { Router } from 'express'
import { requireAuth, requireRole } from '../../middleware/auth'
import * as adminController from './admin.controller'
import { z } from 'zod'
import { validate } from '../../middleware/validate'

const router = Router()

const updateRoleSchema = z.object({
  role: z.enum(['SEEKER', 'EMPLOYER', 'ADMIN']),
})

router.use(requireAuth, requireRole('ADMIN'))

router.get('/admin/users', adminController.listUsers)
router.patch('/admin/users/:id/role', validate(updateRoleSchema), adminController.updateUserRole)
router.get('/admin/jobs', adminController.listJobs)
router.delete('/admin/jobs/:id', adminController.deleteJob)
router.get('/admin/blog-posts', adminController.listBlogPosts)
router.delete('/admin/blog-posts/:id', adminController.deleteBlogPost)

export default router
