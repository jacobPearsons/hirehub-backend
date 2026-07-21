import jwt from 'jsonwebtoken'
import crypto from 'node:crypto'
import { env } from '../../config/env'
import type { JwtPayload } from '../../middleware/auth'

export function signAccessToken(payload: JwtPayload): string {
  const expiresIn = Math.floor(parseDuration(env.JWT_ACCESS_EXPIRES_IN) / 1000)
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn })
}

export function signRefreshToken(payload: JwtPayload): string {
  const expiresIn = Math.floor(parseDuration(env.JWT_REFRESH_EXPIRES_IN) / 1000)
  return jwt.sign({ ...payload, jti: crypto.randomUUID() }, env.JWT_REFRESH_SECRET, { expiresIn })
}

export function verifyRefreshToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as JwtPayload
}

export function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)([smhd])$/)
  if (!match) throw new Error(`Invalid duration: ${duration}`)
  const value = parseInt(match[1])
  const unit = match[2]
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  }
  return value * (multipliers[unit] ?? 0)
}
