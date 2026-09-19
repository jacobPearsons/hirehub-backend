import { Router } from 'express'
import * as skillsController from './skills.controller'

const router = Router()

router.get('/skills/facets', skillsController.facets)
router.get('/skills', skillsController.list)
router.get('/skills/:slug', skillsController.getBySlug)

export default router
