import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import { prisma } from '../../lib/prisma'
import { env } from '../../config/env'
import { signAccessToken, signRefreshToken, verifyRefreshToken, parseDuration } from './jwt'
import { AuthenticationError, ConflictError, NotFoundError, ValidationError } from '../../middleware/error-handler'
import { sendPasswordResetEmail, sendWelcomeEmail } from '../../services/email'
import { ensureDefaultRoles } from '../rbac/ensure-default-roles'
import type { JwtPayload } from '../../middleware/auth'

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  companyName: true,
  phone: true,
  bio: true,
  avatarUrl: true,
  headline: true,
  location: true,
  skills: true,
  resumePath: true,
  resumeFileName: true,
  salaryMin: true,
  salaryMax: true,
  currency: true,
  remoteOnly: true,
  employmentType: true,
  onboardingCompleted: true,
  createdAt: true,
  updatedAt: true,
} as const

export class AuthService {
  async register(data: { name: string; email: string; password: string; role?: string; companyName?: string }) {
    const existing = await prisma.user.findUnique({ where: { email: data.email } })
    if (existing) throw new ConflictError('Email already registered')

    const passwordHash = await bcrypt.hash(data.password, 12)

    await ensureDefaultRoles()

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: data.name,
          email: data.email,
          passwordHash,
          role: (data.role as any) ?? 'SEEKER',
          companyName: data.companyName,
        },
        select: USER_SELECT,
      })

      const defaultRoleId = user.role === 'ADMIN' ? 'admin' : user.role === 'EMPLOYER' ? 'employer' : 'seeker'
      const defaultRole = await tx.role.findUnique({ where: { id: defaultRoleId } })
      if (defaultRole) {
        await tx.roleBinding.create({
          data: { userId: user.id, roleId: defaultRole.id, contextType: 'global', grantedBy: user.id },
        })
      }

      const payload: JwtPayload = { userId: user.id, role: user.role }
      const accessToken = signAccessToken(payload)
      const refreshToken = signRefreshToken(payload)

      const expiresAt = new Date(Date.now() + parseDuration(env.JWT_REFRESH_EXPIRES_IN))
      await tx.refreshToken.create({ data: { token: refreshToken, userId: user.id, expiresAt } })

      return {
        user: { ...user, permissions: await this.getEffectivePermissions(user) },
        accessToken,
        refreshToken,
      }
    })

    sendWelcomeEmail(result.user.name, result.user.email).catch(() => {})

    return result
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
    const permissions = await this.getEffectivePermissions(user)
    return { user: { ...userWithoutPassword, permissions }, accessToken, refreshToken }
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

    const user = await prisma.user.findUnique({ where: { id: payload.userId }, select: { id: true, role: true } })
    if (!user) throw new AuthenticationError('User not found')

    return prisma.$transaction(async (tx) => {
      await tx.refreshToken.delete({ where: { id: stored.id } })

      const newPayload: JwtPayload = { userId: user.id, role: user.role }
      const newAccessToken = signAccessToken(newPayload)
      const newRefreshToken = signRefreshToken(newPayload)

      const expiresAt = new Date(Date.now() + parseDuration(env.JWT_REFRESH_EXPIRES_IN))
      await tx.refreshToken.create({ data: { token: newRefreshToken, userId: user.id, expiresAt } })

      return { accessToken: newAccessToken, refreshToken: newRefreshToken }
    })
  }

  async getMe(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: USER_SELECT,
    })
    if (!user) throw new NotFoundError('User')
    const permissions = await this.getEffectivePermissions(user)
    return { ...user, permissions }
  }

  private async getEffectivePermissions(user: { id: string; role: string }): Promise<string[]> {
    if (user.role === 'ADMIN') return ['*:*']

    const bindings = await prisma.roleBinding.findMany({
      where: {
        userId: user.id,
        status: 'active',
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      include: { role: true },
    })

    const permissions = new Set<string>()
    for (const binding of bindings) {
      for (const capability of (binding.role.capabilities as string[]) ?? []) {
        permissions.add(capability)
      }
    }
    return [...permissions]
  }

  async updateProfile(userId: string, data: { name?: string; email?: string; phone?: string | null; bio?: string | null; companyName?: string | null; headline?: string; location?: string; skills?: string[]; salaryMin?: number; salaryMax?: number; currency?: string; remoteOnly?: boolean; employmentType?: string; resumePath?: string; resumeFileName?: string; onboardingCompleted?: boolean }) {
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
        ...(data.headline !== undefined && { headline: data.headline }),
        ...(data.location !== undefined && { location: data.location }),
        ...(data.skills !== undefined && { skills: data.skills }),
        ...(data.salaryMin !== undefined && { salaryMin: data.salaryMin }),
        ...(data.salaryMax !== undefined && { salaryMax: data.salaryMax }),
        ...(data.currency !== undefined && { currency: data.currency }),
        ...(data.remoteOnly !== undefined && { remoteOnly: data.remoteOnly }),
        ...(data.employmentType !== undefined && { employmentType: data.employmentType }),
        ...(data.resumePath !== undefined && { resumePath: data.resumePath }),
        ...(data.resumeFileName !== undefined && { resumeFileName: data.resumeFileName }),
        ...(data.onboardingCompleted !== undefined && { onboardingCompleted: data.onboardingCompleted }),
      },
      select: USER_SELECT,
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
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { passwordHash: hash } })
      await tx.refreshToken.deleteMany({ where: { userId } })
    })
  }

  async forgotPassword(email: string) {
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      return
    }

    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000)

    await prisma.$transaction(async (tx) => {
      await tx.resetToken.deleteMany({ where: { userId: user.id } })
      await tx.resetToken.create({
        data: { token, userId: user.id, expiresAt },
      })
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

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash },
      })
      await tx.resetToken.delete({ where: { id: resetToken.id } })
      await tx.refreshToken.deleteMany({ where: { userId: resetToken.userId } })
    })
  }
}

export const authService = new AuthService()
