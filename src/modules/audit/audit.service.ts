import { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma'

interface AuditEventInput {
  actorId?: string
  action: string
  resource: string
  resourceId?: string
  metadata?: Record<string, unknown>
  ipAddress?: string
}

export class AuditService {
  async logEvent(input: AuditEventInput): Promise<void> {
    try {
      await prisma.auditEvent.create({
        data: {
          actorId: input.actorId ?? null,
          action: input.action,
          resource: input.resource,
          resourceId: input.resourceId ?? null,
          metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
          ipAddress: input.ipAddress ?? null,
        },
      })
    } catch (error) {
      // Audit logging should never fail the request
      console.error('[Audit] Failed to log event:', error)
    }
  }
}

export const auditService = new AuditService()
