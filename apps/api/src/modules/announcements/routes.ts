import { Router } from 'express'
import { createAnnouncementSchema, updateAnnouncementSchema } from '@pavati/shared'
import { prismaPublic } from '../../lib/prisma.js'
import { visibleUserMap } from '../../lib/userProjection.js'
import { AppError, asyncHandler, ok } from '../../lib/http.js'
import { requireAuth } from '../../middleware/auth.js'
import { loadTrustContext, requirePermission, type TrustContextRequest } from '../../middleware/rbac.js'
import { validateBody } from '../../middleware/validate.js'
import { audit } from '../../services/audit.js'

const router = Router()

/**
 * Credential-free author select. Email and phone are fetched here on purpose so
 * `visibleUserMap` can apply the contactVisible consent decision; without them in the
 * query the map has nothing to conditionally release.
 */
const AUTHOR_SELECT = { id: true, name: true, profileImage: true, email: true, phone: true } as const

router.use('/:trustId/announcements', requireAuth, loadTrustContext)

router.get(
  '/:trustId/announcements',
  requirePermission('announcement:view'),
  asyncHandler(async (req: TrustContextRequest, res) => {
    const page = Number(req.query.page ?? 1)
    const pageSize = Number(req.query.pageSize ?? 20)
    const [total, items] = await Promise.all([
      prismaPublic.announcement.count({ where: { trustId: req.trustId } }),
      prismaPublic.announcement.findMany({
        where: { trustId: req.trustId },
        include: { author: { select: AUTHOR_SELECT } },
        orderBy: [{ pinned: 'desc' }, { publishedAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ])
    const visible = await visibleUserMap(req.trustId!, items.map((i) => i.authorId))
    ok(res, { total, page, pageSize, items: items.map((i) => ({ ...i, author: visible.get(i.authorId)! })) })
  })
)

router.post(
  '/:trustId/announcements',
  requirePermission('announcement:create'),
  validateBody(createAnnouncementSchema),
  asyncHandler(async (req: TrustContextRequest, res) => {
    const body = req.body
    // announcement:create must not confer prominence: enforce the same gate the
    // dedicated pin route applies.
    if (body.pinned && !req.effectivePermissions?.includes('announcement:pin')) {
      throw new AppError(403, 'Missing permission: announcement:pin (required to pin an announcement)')
    }
    const announcement = await prismaPublic.announcement.create({
      data: {
        trustId: req.trustId!,
        authorId: req.user!.id,
        type: body.type,
        title: body.title,
        content: body.content,
        mediaUrl: body.mediaUrl ?? null,
        pinned: body.pinned,
      },
      include: { author: { select: AUTHOR_SELECT } },
    })
    await audit({ actorId: req.user!.id, trustId: req.trustId, action: 'ANNOUNCEMENT_CREATED', entityType: 'Announcement', entityId: announcement.id, metadata: { title: announcement.title } })
    const visible = await visibleUserMap(req.trustId!, [announcement.authorId])
    ok(res, { ...announcement, author: visible.get(announcement.authorId)! }, 201)
  })
)

router.patch(
  '/:trustId/announcements/:announcementId',
  requirePermission('announcement:update'),
  validateBody(updateAnnouncementSchema),
  asyncHandler(async (req: TrustContextRequest, res) => {
    const announcement = await prismaPublic.announcement.findFirst({ where: { id: req.params.announcementId, trustId: req.trustId } })
    if (!announcement) throw new AppError(404, 'Announcement not found')
    const body = req.body
    if ((body as { pinned?: boolean }).pinned && !req.effectivePermissions?.includes('announcement:pin')) {
      throw new AppError(403, 'Missing permission: announcement:pin (required to pin an announcement)')
    }
    const updated = await prismaPublic.announcement.update({
      where: { id: announcement.id },
      data: {
        ...(body.title !== undefined && { title: body.title }),
        ...(body.content !== undefined && { content: body.content }),
        ...(body.mediaUrl !== undefined && { mediaUrl: body.mediaUrl }),
        ...(body.type !== undefined && { type: body.type }),
        ...((body as { pinned?: boolean }).pinned !== undefined && { pinned: (body as { pinned?: boolean }).pinned }),
      },
      include: { author: { select: AUTHOR_SELECT } },
    })
    await audit({ actorId: req.user!.id, trustId: req.trustId, action: 'ANNOUNCEMENT_UPDATED', entityType: 'Announcement', entityId: announcement.id })
    const visible = await visibleUserMap(req.trustId!, [updated.authorId])
    ok(res, { ...updated, author: visible.get(updated.authorId)! })
  })
)

router.delete(
  '/:trustId/announcements/:announcementId',
  requirePermission('announcement:delete'),
  asyncHandler(async (req: TrustContextRequest, res) => {
    const announcement = await prismaPublic.announcement.findFirst({ where: { id: req.params.announcementId, trustId: req.trustId } })
    if (!announcement) throw new AppError(404, 'Announcement not found')
    await prismaPublic.announcement.delete({ where: { id: announcement.id } })
    await audit({ actorId: req.user!.id, trustId: req.trustId, action: 'ANNOUNCEMENT_DELETED', entityType: 'Announcement', entityId: announcement.id })
    ok(res, { message: 'Announcement deleted' })
  })
)

router.post(
  '/:trustId/announcements/:announcementId/pin',
  requirePermission('announcement:pin'),
  asyncHandler(async (req: TrustContextRequest, res) => {
    const announcement = await prismaPublic.announcement.findFirst({ where: { id: req.params.announcementId, trustId: req.trustId } })
    if (!announcement) throw new AppError(404, 'Announcement not found')
    const updated = await prismaPublic.announcement.update({ where: { id: announcement.id }, data: { pinned: !announcement.pinned } })
    ok(res, updated)
  })
)

export default router
