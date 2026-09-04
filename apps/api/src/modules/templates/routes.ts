import { Router } from 'express'
import { prisma } from '../../lib/prisma.js'
import { AppError, asyncHandler, ok } from '../../lib/http.js'
import { requireAuth } from '../../middleware/auth.js'
import { loadTrustContext, requirePermission, type TrustContextRequest } from '../../middleware/rbac.js'
import { validateBody } from '../../middleware/validate.js'
import { createTemplateSchema, updateTemplateSchema } from '@pavati/shared'
import { audit } from '../../services/audit.js'

const router = Router()

router.use('/:trustId/templates', requireAuth, loadTrustContext)

router.get(
  '/:trustId/templates',
  requirePermission('template:manage'),
  asyncHandler(async (req: TrustContextRequest, res) => {
    const templates = await prisma.receiptTemplate.findMany({
      where: { trustId: req.trustId },
      orderBy: { createdAt: 'asc' },
    })
    ok(res, templates)
  })
)

router.post(
  '/:trustId/templates',
  requirePermission('template:manage'),
  validateBody(createTemplateSchema),
  asyncHandler(async (req: TrustContextRequest, res) => {
    const body = req.body
    const count = await prisma.receiptTemplate.count({ where: { trustId: req.trustId } })
    const template = await prisma.receiptTemplate.create({
      data: {
        trustId: req.trustId!,
        name: body.name,
        pageSize: body.pageSize,
        widthMm: body.widthMm ?? null,
        heightMm: body.heightMm ?? null,
        backgroundImageUrl: body.backgroundImageUrl ?? null,
        fieldConfigs: body.fieldConfigs,
        active: count === 0,
      },
    })
    await audit({ actorId: req.user!.id, trustId: req.trustId, action: 'TEMPLATE_CREATED', entityType: 'ReceiptTemplate', entityId: template.id, metadata: { name: template.name } })
    ok(res, template, 201)
  })
)

router.get(
  '/:trustId/templates/:templateId',
  requirePermission('template:manage'),
  asyncHandler(async (req: TrustContextRequest, res) => {
    const template = await prisma.receiptTemplate.findFirst({ where: { id: req.params.templateId, trustId: req.trustId } })
    if (!template) throw new AppError(404, 'Template not found')
    ok(res, template)
  })
)

router.patch(
  '/:trustId/templates/:templateId',
  requirePermission('template:manage'),
  validateBody(updateTemplateSchema),
  asyncHandler(async (req: TrustContextRequest, res) => {
    const template = await prisma.receiptTemplate.findFirst({ where: { id: req.params.templateId, trustId: req.trustId } })
    if (!template) throw new AppError(404, 'Template not found')
    const body = req.body
    const updated = await prisma.receiptTemplate.update({
      where: { id: template.id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.pageSize !== undefined && { pageSize: body.pageSize }),
        ...(body.widthMm !== undefined && { widthMm: body.widthMm }),
        ...(body.heightMm !== undefined && { heightMm: body.heightMm }),
        ...(body.backgroundImageUrl !== undefined && { backgroundImageUrl: body.backgroundImageUrl }),
        ...(body.fieldConfigs !== undefined && { fieldConfigs: body.fieldConfigs }),
      },
    })
    await audit({ actorId: req.user!.id, trustId: req.trustId, action: 'TEMPLATE_UPDATED', entityType: 'ReceiptTemplate', entityId: template.id })
    ok(res, updated)
  })
)

router.post(
  '/:trustId/templates/:templateId/activate',
  requirePermission('template:manage'),
  asyncHandler(async (req: TrustContextRequest, res) => {
    const template = await prisma.receiptTemplate.findFirst({ where: { id: req.params.templateId, trustId: req.trustId } })
    if (!template) throw new AppError(404, 'Template not found')
    await prisma.$transaction([
      prisma.receiptTemplate.updateMany({ where: { trustId: req.trustId }, data: { active: false } }),
      prisma.receiptTemplate.update({ where: { id: template.id }, data: { active: true } }),
    ])
    await audit({ actorId: req.user!.id, trustId: req.trustId, action: 'TEMPLATE_ACTIVATED', entityType: 'ReceiptTemplate', entityId: template.id })
    ok(res, { message: 'Template activated', templateId: template.id })
  })
)

router.delete(
  '/:trustId/templates/:templateId',
  requirePermission('template:manage'),
  asyncHandler(async (req: TrustContextRequest, res) => {
    const template = await prisma.receiptTemplate.findFirst({ where: { id: req.params.templateId, trustId: req.trustId } })
    if (!template) throw new AppError(404, 'Template not found')
    const inUse = await prisma.receipt.count({ where: { templateId: template.id } })
    if (inUse > 0) throw new AppError(400, 'Template is in use by receipts and cannot be deleted')
    await prisma.receiptTemplate.delete({ where: { id: template.id } })
    await audit({ actorId: req.user!.id, trustId: req.trustId, action: 'TEMPLATE_UPDATED', entityType: 'ReceiptTemplate', entityId: template.id, metadata: { deleted: true } })
    ok(res, { message: 'Template deleted' })
  })
)

export default router