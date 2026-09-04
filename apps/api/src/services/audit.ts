import { prisma } from '../lib/prisma.js'
import { logger } from '../lib/logger.js'
import type { AuditAction } from '@pavati/shared'

interface AuditInput {
  actorId?: string | null
  trustId?: string | null
  action: AuditAction | string
  entityType?: string | null
  entityId?: string | null
  metadata?: Record<string, unknown> | null
}

export async function audit(entry: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: entry.actorId ?? null,
        trustId: entry.trustId ?? null,
        action: entry.action,
        entityType: entry.entityType ?? null,
        entityId: entry.entityId ?? null,
        metadata: (entry.metadata as object | null) ?? undefined,
      },
    })
  } catch (err) {
    logger.error({ err, action: entry.action }, 'audit log insert failed')
  }
}