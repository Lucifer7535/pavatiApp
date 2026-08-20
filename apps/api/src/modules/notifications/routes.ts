import { Router } from 'express'
import { prisma } from '../../lib/prisma.js'
import { asyncHandler, ok } from '../../lib/http.js'
import { requireAuth } from '../../middleware/auth.js'
import { loadTrustContext, requirePermission, type TrustContextRequest } from '../../middleware/rbac.js'
import { validateBody } from '../../middleware/validate.js'
import { updateNotificationSettingsSchema } from '@pavati/shared'
import { audit } from '../../services/audit.js'

const router = Router()

router.use('/:trustId/notifications', requireAuth, loadTrustContext)

router.get(
  '/:trustId/notifications',
  requirePermission('notification:manage'),
  asyncHandler(async (req: TrustContextRequest, res) => {
    const page = Number(req.query.page ?? 1)
    const pageSize = Number(req.query.pageSize ?? 30)
    const [total, items] = await Promise.all([
      prisma.notification.count({ where: { trustId: req.trustId } }),
      prisma.notification.findMany({
        where: { trustId: req.trustId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ])
    ok(res, { total, page, pageSize, items })
  })
)

router.get(
  '/:trustId/notifications/settings',
  requirePermission('notification:manage'),
  asyncHandler(async (req: TrustContextRequest, res) => {
    const trust = await prisma.trust.findUnique({ where: { id: req.trustId }, select: { notificationSms: true, notificationWhatsapp: true, notificationEmail: true } })
    ok(res, trust)
  })
)

router.patch(
  '/:trustId/notifications/settings',
  requirePermission('notification:manage'),
  validateBody(updateNotificationSettingsSchema),
  asyncHandler(async (req: TrustContextRequest, res) => {
    const body = req.body
    const trust = await prisma.trust.update({
      where: { id: req.trustId },
      data: { notificationSms: body.sms, notificationWhatsapp: body.whatsapp, notificationEmail: body.email },
    })
    await audit({ actorId: req.user!.id, trustId: req.trustId, action: 'SETTINGS_UPDATED', entityType: 'Trust', entityId: trust.id, metadata: { notificationSettings: body } })
    ok(res, { notificationSms: trust.notificationSms, notificationWhatsapp: trust.notificationWhatsapp, notificationEmail: trust.notificationEmail })
  })
)

export default router