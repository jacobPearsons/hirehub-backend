import rateLimit from 'express-rate-limit'
import { env } from '../config/env'

const skip = () => env.NODE_ENV === 'test'

export const generalLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  skip,
  message: { success: false, error: 'Too many requests, please try again later' },
})

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip,
  message: { success: false, error: 'Too many login attempts, please try again later' },
})

export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip,
  message: { success: false, error: 'Too many uploads, please try again later' },
})
