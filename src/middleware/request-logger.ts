import pinoHttp from 'pino-http'
import { logger } from '../config/logger'

const SKIP_PATHS = ['/api/health']

export const requestLogger = pinoHttp({
  logger,
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie'],
    censor: '[REDACTED]',
  },
  autoLogging: {
    ignore: (req) => SKIP_PATHS.includes(req.url ?? ''),
  },
  customSuccessMessage(req, res) {
    return `${req.method} ${req.url} ${res.statusCode}`
  },
  customErrorMessage(_req, res, err) {
    return `${err.message} ${res.statusCode}`
  },
  genReqId: (req) => (req as any).id as string,
})
