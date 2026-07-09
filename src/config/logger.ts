import pino from 'pino'
import { env } from './env'

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: ['password', 'passwordHash', 'token', 'accessToken', 'refreshToken', 'secret', 'authorization'],
    censor: '[REDACTED]',
  },
  transport: env.NODE_ENV === 'development'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
})
