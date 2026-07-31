import 'dotenv/config'
import app from './app'
import { env } from '../config/env'
import { logger } from '../config/logger'
import { prisma } from '../lib/prisma'
import { ensureSearchIndex } from '../services/search'

let server: ReturnType<typeof app.listen>

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception')
  prisma.$disconnect().finally(() => process.exit(1))
})

process.on('unhandledRejection', (reason) => {
  logger.fatal({ reason }, 'Unhandled rejection')
  prisma.$disconnect().finally(() => process.exit(1))
})

prisma.$connect()
  .then(() => ensureSearchIndex())
  .then(() => {
    server = app.listen(env.PORT, () => {
      logger.info({ port: env.PORT, env: env.NODE_ENV }, 'Server started')
    })
  })
  .catch((err) => {
    logger.fatal({ err }, 'Failed to start server')
    process.exit(1)
  })

function shutdown(signal: string) {
  logger.info({ signal }, 'Shutting down gracefully')
  server?.close(async () => {
    await prisma.$disconnect()
    logger.info('Server closed')
    process.exit(0)
  })
  setTimeout(() => process.exit(1), 10000).unref()
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
