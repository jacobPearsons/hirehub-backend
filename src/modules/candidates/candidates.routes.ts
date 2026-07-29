import { Router } from 'express'
import { requireAuth } from '../../middleware/auth'
import * as candidatesController from './candidates.controller'

const router = Router()

router.get('/candidates', requireAuth, candidatesController.search)

export default router
