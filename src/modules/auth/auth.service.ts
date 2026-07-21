import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import { prisma } from '../../lib/prisma'
import { env } from '../../config/env'
import { signAccessToken, signRefreshToken, verifyRefreshToken, parseDuration } from './jwt'
import { AuthenticationError, ConflictError, NotFoundError, ValidationError } from '../../middleware/error-handler'
import { sendPasswordResetEmail, sendWelcomeEmail } from '../../services/email'
import type { JwtPayload } from '../../middleware/auth'

export class AuthService {
  async register(data: { name: string; email: string; password: string; role?: string; companyName?: string }) {
    const existing = await prisma.user.findUnique({ where: { email: data.email } })
    if (existing) throw new ConflictError('Email already registered')

    const passwordHash = await bcrypt.hash(data.password, 12)
    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        passwordHash,
        role: (data.role as any) ?? 'SEEKER',
        companyName: data.companyName,
      },
      select: { id: true, name: true, email: true, role: true, companyName: true, createdAt: true, updatedAt: true },
    })

    sendWelcomeEmail(user.name, user.email).catch(() => {})

    const payload: JwtPayload = { userId: user.id, role: user.role }
    const accessToken = signAccessToken(payload)
    const refreshToken = signRefreshToken(payload)

    const expiresAt = new Date(Date.now() + parseDuration(env.JWT_REFRESH_EXPIRES_IN))
    await prisma.refreshToken.create({ data: { token: refreshToken, userId: user.id, expiresAt } })

    return { user, accessToken, refreshToken }
  }

  async login(email: string, password: string) {
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) throw new AuthenticationError('Invalid credentials')

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) throw new AuthenticationError('Invalid credentials')

    const payload: JwtPayload = { userId: user.id, role: user.role }
    const accessToken = signAccessToken(payload)
    const refreshToken = signRefreshToken(payload)

    const expiresAt = new Date(Date.now() + parseDuration(env.JWT_REFRESH_EXPIRES_IN))
    await prisma.refreshToken.create({ data: { token: refreshToken, userId: user.id, expiresAt } })

    const { passwordHash: _, ...userWithoutPassword } = user
    return { user: userWithoutPassword, accessToken, refreshToken }
  }

  async logout(refreshToken: string) {
    await prisma.refreshToken.deleteMany({ where: { token: refreshToken } })
  }

  async refresh(refreshToken: string) {
    let payload: JwtPayload
    try {
      payload = verifyRefreshToken(refreshToken)
    } catch {
      throw new AuthenticationError('Invalid refresh token')
    }

    const stored = await prisma.refreshToken.findUnique({ where: { token: refreshToken } })
    if (!stored) throw new AuthenticationError('Refresh token not found')

    await prisma.refreshToken.delete({ where: { id: stored.id } })

    const newPayload: JwtPayload = { userId: payload.userId, role: payload.role }
    const newAccessToken = signAccessToken(newPayload)
    const newRefreshToken = signRefreshToken(newPayload)

    const expiresAt = new Date(Date.now() + parseDuration(env.JWT_REFRESH_EXPIRES_IN))
    await prisma.refreshToken.create({ data: { token: newRefreshToken, userId: payload.userId, expiresAt } })

    return { accessToken: newAccessToken, refreshToken: newRefreshToken }
  }

  async getMe(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true, companyName: true, phone: true, bio: true, avatarUrl: true, createdAt: true, updatedAt: true },
    })
    if (!user) throw new NotFoundError('User')
    return user
  }

  async updateProfile(userId: string, data: { name?: string; email?: string; phone?: string | null; bio?: string | null; companyName?: string | null }) {
    if (data.email) {
      const existing = await prisma.user.findUnique({ where: { email: data.email } })
      if (existing && existing.id !== userId) {
        throw new ConflictError('Email already in use')
      }
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.email !== undefined && { email: data.email }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.bio !== undefined && { bio: data.bio }),
        ...(data.companyName !== undefined && { companyName: data.companyName }),
      },
      select: { id: true, name: true, email: true, role: true, companyName: true, phone: true, bio: true, avatarUrl: true, createdAt: true, updatedAt: true },
    })
    return updated
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
    const valid = await bcrypt.compare(currentPassword, user.passwordHash)
    if (!valid) {
      throw new AuthenticationError('Current password is incorrect')
    }
    const hash = await bcrypt.hash(newPassword, 12)
    await prisma.user.update({ where: { id: userId }, data: { passwordHash: hash } })
    await prisma.refreshToken.deleteMany({ where: { userId } })
  }

  async forgotPassword(email: string) {
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      return
    }

    await prisma.resetToken.deleteMany({ where: { userId: user.id } })

    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000)

    await prisma.resetToken.create({
      data: { token, userId: user.id, expiresAt },
    })

    const resetUrl = `${env.APP_URL}/reset-password?token=${token}`
    await sendPasswordResetEmail(email, resetUrl)
  }

  async resetPassword(token: string, newPassword: string) {
    const resetToken = await prisma.resetToken.findUnique({ where: { token } })
    if (!resetToken || resetToken.expiresAt < new Date()) {
      throw new ValidationError('Invalid or expired reset token')
    }

    const passwordHash = await bcrypt.hash(newPassword, 12)
    await prisma.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash },
    })

    await prisma.resetToken.delete({ where: { id: resetToken.id } })
    await prisma.refreshToken.deleteMany({ where: { userId: resetToken.userId } })
  }
}

export const authService = new AuthService()
