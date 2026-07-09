import { Router } from 'express'
import * as blogController from './blog.controller'

const router = Router()

router.get('/blog-posts', blogController.list)
router.get('/blog-posts/:slug', blogController.getBySlug)

export default router
