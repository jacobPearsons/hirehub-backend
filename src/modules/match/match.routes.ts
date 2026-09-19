import { Router } from 'express'
import { validate } from '../../middleware/validate'
import { matchBodySchema } from './match.schema'
import * as matchController from './match.controller'

const router = Router()

router.post('/match', validate(matchBodySchema), matchController.match)

export default router
