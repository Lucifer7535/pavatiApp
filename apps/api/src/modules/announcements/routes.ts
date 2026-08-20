import { Router } from 'express'
import { createAnnouncementSchema, updateAnnouncementSchema } from '@pavati/shared'
import { prisma } from '../../lib/prisma.js'
import { AppError, asyncHandler, ok } from '../../lib/http.js'
import { requireAuth } from '../../middleware/auth.js'
import { loadTrustContext, requirePermission, type TrustContextRequest } from '../../middleware/rbac.js'
import { validateBody } from '../../middleware/validate.js'
import { audit } from '../../services/audit.js'

const router = Router()

router.use('/:trustId/announcements', requireAuth, loadTrustContext)

router.get(
  '/:trustId/announcements',
  requirePermission('announcement:view'),
  asyncHandler(async (req: TrustContextRequest, res) => {
    const page = Number(req.query.page ?? 1)
    const pageSize = Number(req.query.pageSize ?? 20)
    const [total, items] = await Promise.all([
      prisma.announcement.count({ where: { trustId: req.trustId } }),
      prisma.announcement.findMany({
        where: { trustId: req.trustId },
        include: { author: true },
        orderBy: [{ pinned: 'desc' }, { publishedAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ])
    ok(res, { total, page, pageSize, items })
  })
)

router.post(
  '/:trustId/announcements',
  requirePermission('announcement:create'),
  validateBody(createAnnouncementSchema),
  asyncHandler(async (req: TrustContextRequest, res) => {
    const body = req.body
    const announcement = await prisma.announcement.create({
      data: {
        trustId: req.trustId!,
        authorId: req.user!.id,
        type: body.type,
        title: body.title,
        content: body.content,
        mediaUrl: body.mediaUrl ?? null,
        pinned: body.pinned,
      },
      include: { author: true },
    })
    await audit({ actorId: req.user!.id, trustId: req.trustId, action: 'ANNOUNCEMENT_CREATED', entityType: 'Announcement', entityId: announcement.id, metadata: { title: announcement.title } })
    ok(res, announcement, 201)
  })
)

router.patch(
  '/:trustId/announcements/:announcementId',
  requirePermission('announcement:update'),
  validateBody(updateAnnouncementSchema),
  asyncHandler(async (req: TrustContextRequest, res) => {
    const announcement = await prisma.announcement.findFirst({ where: { id: req.params.announcementId, trustId: req.trustId } })
    if (!announcement) throw new AppError(404, 'Announcement not found')
    const body = req.body
    const updated = await prisma.announcement.update({
      where: { id: announcement.id },
      data: {
        ...(body.title !== undefined && { title: body.title }),
        ...(body.content !== undefined && { content: body.content }),
        ...(body.mediaUrl !== undefined && { mediaUrl: body.mediaUrl }),
        ...(body.type !== undefined && { type: body.type }),
      },
      include: { author: true },
    })
    await audit({ actorId: req.user!.id, trustId: req.trustId, action: 'ANNOUNCEMENT_UPDATED', entityType: 'Announcement', entityId: announcement.id })
    ok(res, updated)
  })
)

router.delete(
  '/:trustId/announcements/:announcementId',
  requirePermission('announcement:delete'),
  asyncHandler(async (req: TrustContextRequest, res) => {
    const announcement = await prisma.announcement.findFirst({ where: { id: req.params.announcementId, trustId: req.trustId } })
    if (!announcement) throw new AppError(404, 'Announcement not found')
    await prisma.announcement.delete({ where: { id: announcement.id } })
    await audit({ actorId: req.user!.id, trustId: req.trustId, action: 'ANNOUNCEMENT_DELETED', entityType: 'Announcement', entityId: announcement.id })
    ok(res, { message: 'Announcement deleted' })
  })
)

router.post(
  '/:trustId/announcements/:announcementId/pin',
  requirePermission('announcement:pin'),
  asyncHandler(async (req: TrustContextRequest, res) => {
    const announcement = await prisma.announcement.findFirst({ where: { id: req.params.announcementId, trustId: req.trustId } })
    if (!announcement) throw new AppError(404, 'Announcement not found')
    const updated = await prisma.announcement.update({ where: { id: announcement.id }, data: { pinned: !announcement.pinned } })
    ok(res, updated)
  })
)

export default router