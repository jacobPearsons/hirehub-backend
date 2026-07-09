import { Router } from 'express'
import * as pricingController from './pricing.controller'

const router = Router()

router.get('/pricing', pricingController.getAll)

export default router
