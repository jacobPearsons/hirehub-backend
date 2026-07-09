import { Router } from 'express'
import { validate } from '../../middleware/validate'
import { requireAuth } from '../../middleware/auth'
import { z } from 'zod'
import * as authController from './auth.controller'

const router = Router()

const registerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['SEEKER', 'EMPLOYER']).optional(),
  companyName: z.string().optional(),
})

const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password is required'),
})

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email'),
})

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

router.post('/auth/register', validate(registerSchema), authController.register)
router.post('/auth/login', validate(loginSchema), authController.login)
router.post('/auth/logout', requireAuth, authController.logout)
router.get('/auth/me', requireAuth, authController.getMe)
router.post('/auth/refresh', authController.refresh)
router.post('/auth/forgot-password', validate(forgotPasswordSchema), authController.forgotPassword)
router.post('/auth/reset-password', validate(resetPasswordSchema), authController.resetPassword)

export default router
