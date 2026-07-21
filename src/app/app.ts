import 'express-async-errors'
import * as Sentry from '@sentry/node'
import path from 'path'
import { fileURLToPath } from 'url'
import express from 'express'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
import helmet from 'helmet'
import compression from 'compression'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { generalLimiter, authLimiter, uploadLimiter } from '../middleware/rate-limiters'
import { requestId } from '../middleware/request-id'
import { errorHandler } from '../middleware/error-handler'
import { env } from '../config/env'
import { prisma } from '../lib/prisma'
import authRoutes from '../modules/auth/auth.routes'
import jobsRoutes from '../modules/jobs/jobs.routes'
import applicationsRoutes from '../modules/applications/applications.routes'
import savedJobsRoutes from '../modules/saved-jobs/saved-jobs.routes'
import blogRoutes from '../modules/blog/blog.routes'
import contactRoutes from '../modules/contact/contact.routes'
import pricingRoutes from '../modules/pricing/pricing.routes'
import uploadRoutes from '../modules/upload/upload.routes'
import adminRoutes from '../modules/admin/admin.routes'
import swaggerUi from 'swagger-ui-express'
import { swaggerSpec } from '../config/swagger'

const app = express()

app.use(helmet())
app.use(compression())
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }))
app.use(cookieParser())
app.use(requestId)
app.use(express.json({ limit: '1mb' }))
app.use('/logos', express.static(path.join(__dirname, '../../public/logos'), {
  maxAge: '7d',
  immutable: true,
}))
app.use('/avatars', express.static(path.join(process.cwd(), 'uploads', 'avatars'), { maxAge: '7d' }))
app.use(generalLimiter)

if (env.SENTRY_DSN) {
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    tracesSampleRate: env.NODE_ENV === 'production' ? 0.1 : 0,
  })
}

app.get('/api/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    res.json({ success: true, data: { status: 'ok', database: 'connected', timestamp: new Date().toISOString() } })
  } catch {
    res.status(503).json({ success: false, error: 'Database unavailable' })
  }
})

app.use('/api/auth/login', authLimiter)
app.use('/api/auth/register', authLimiter)
app.use('/api/auth/forgot-password', authLimiter)
app.use('/api/auth/reset-password', authLimiter)
app.use('/api', authRoutes)
app.use('/api', jobsRoutes)
app.use('/api', applicationsRoutes)
app.use('/api', savedJobsRoutes)
app.use('/api', blogRoutes)
app.use('/api', contactRoutes)
app.use('/api', pricingRoutes)
app.use('/api/upload', uploadLimiter)
app.use('/api', uploadRoutes)
app.use('/api', adminRoutes)

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, { customCss: '.swagger-ui .topbar { display: none }' }))

if (env.SENTRY_DSN) {
  Sentry.setupExpressErrorHandler(app)
}

app.use(errorHandler)

export default app
