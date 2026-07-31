import { Router } from 'express'
import { validate } from '../../middleware/validate'
import { requireAuth } from '../../middleware/auth'
import { z } from 'zod'
import * as authController from './auth.controller'
import { uploadAvatar } from '../../services/upload'

const router = Router()

const registerSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['SEEKER', 'EMPLOYER']).optional(),
  companyName: z.string().max(100).optional(),
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

const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(20).optional().nullable(),
  bio: z.string().max(500).optional().nullable(),
  companyName: z.string().max(100).optional().nullable(),
  headline: z.string().max(120).optional(),
  location: z.string().max(100).optional(),
  skills: z.array(z.string().min(1).max(50)).min(1).max(15).optional(),
  salaryMin: z.number().int().nonnegative().optional(),
  salaryMax: z.number().int().nonnegative().optional(),
  currency: z.string().max(3).optional(),
  remoteOnly: z.boolean().optional(),
  employmentType: z.string().max(50).optional(),
  resumePath: z.string().max(255).optional(),
  resumeFileName: z.string().max(255).optional(),
  onboardingCompleted: z.boolean().optional(),
})

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
})

router.post('/auth/register', validate(registerSchema), authController.register)
router.post('/auth/login', validate(loginSchema), authController.login)
router.post('/auth/logout', requireAuth, authController.logout)
router.get('/auth/me', requireAuth, authController.getMe)
router.post('/auth/refresh', authController.refresh)
router.post('/auth/forgot-password', validate(forgotPasswordSchema), authController.forgotPassword)
router.post('/auth/reset-password', validate(resetPasswordSchema), authController.resetPassword)
router.patch('/auth/profile', requireAuth, validate(updateProfileSchema), authController.updateProfile)
router.patch('/auth/password', requireAuth, validate(changePasswordSchema), authController.changePassword)
router.post('/auth/avatar', requireAuth, uploadAvatar.single('avatar'), authController.uploadAvatar)

export default router
