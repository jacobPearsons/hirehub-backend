import { z } from 'zod'

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string(),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  CORS_ORIGIN: z.string().default('http://localhost:5173,http://localhost:3000'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000),
  RATE_LIMIT_MAX: z.coerce.number().default(100),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  RESEND_API_KEY: z.string().optional(),
  APP_URL: z.string().default('http://localhost:5173'),
  UPLOAD_DIR: z.string().default('uploads'),
  MAX_FILE_SIZE_MB: z.coerce.number().default(10),
  DEMO_BOT_ENABLED: z.string().optional().transform((value) => value === 'true'),
  SENTRY_DSN: z.string().optional(),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors)
  process.exit(1)
}

export const env = parsed.data

// --- CORS_ORIGIN production safety checks ---
if (env.NODE_ENV === 'production') {
  if (env.CORS_ORIGIN === 'http://localhost:5173') {
    throw new Error(
      'CORS_ORIGIN must not be the development default (http://localhost:5173) in production',
    )
  }

  if (env.CORS_ORIGIN === '*') {
    throw new Error('CORS_ORIGIN must not be a wildcard (*) in production')
  }

  if (!env.CORS_ORIGIN.startsWith('http://') && !env.CORS_ORIGIN.startsWith('https://')) {
    throw new Error(
      `CORS_ORIGIN must be a valid URL starting with http:// or https:// in production. Received: ${env.CORS_ORIGIN}`,
    )
  }

  if (env.CORS_ORIGIN.includes('localhost') || env.CORS_ORIGIN.includes('127.0.0.1')) {
    console.warn(`Warning: CORS_ORIGIN looks like a development URL in production: ${env.CORS_ORIGIN}`)
  }
}
