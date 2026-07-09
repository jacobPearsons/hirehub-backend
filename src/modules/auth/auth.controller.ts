import type { Request, Response, NextFunction } from 'express'
import { authService } from './auth.service'
import { success, created } from '../../lib/response'
import { env } from '../../config/env'

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/api/auth',
  maxAge: 7 * 24 * 60 * 60 * 1000,
}

function setRefreshCookie(res: Response, token: string) {
  res.cookie('refreshToken', token, REFRESH_COOKIE_OPTIONS)
}

function clearRefreshCookie(res: Response) {
  res.clearCookie('refreshToken', { path: '/api/auth' })
}

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.register(req.body)
    setRefreshCookie(res, result.refreshToken)
    created(res, { user: result.user, accessToken: result.accessToken })
  } catch (error) {
    next(error)
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.login(req.body.email, req.body.password)
    setRefreshCookie(res, result.refreshToken)
    success(res, { user: result.user, accessToken: result.accessToken })
  } catch (error) {
    next(error)
  }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    const refreshToken = req.cookies?.refreshToken
    if (refreshToken) {
      await authService.logout(refreshToken)
    }
    clearRefreshCookie(res)
    success(res, { message: 'Logged out successfully' })
  } catch (error) {
    next(error)
  }
}

export async function getMe(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await authService.getMe(req.user!.userId)
    success(res, user)
  } catch (error) {
    next(error)
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction) {
  try {
    const refreshToken = req.cookies?.refreshToken
    if (!refreshToken) {
      res.status(401).json({ success: false, error: 'No refresh token' })
      return
    }
    const result = await authService.refresh(refreshToken)
    setRefreshCookie(res, result.refreshToken)
    success(res, { accessToken: result.accessToken })
  } catch (error) {
    next(error)
  }
}

export async function forgotPassword(req: Request, res: Response) {
  await authService.forgotPassword(req.body.email)
  success(res, { message: 'If that email is registered, a reset link has been sent' })
}

export async function resetPassword(req: Request, res: Response) {
  await authService.resetPassword(req.body.token, req.body.password)
  success(res, { message: 'Password reset successfully' })
}
