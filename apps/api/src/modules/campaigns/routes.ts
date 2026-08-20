import { Router } from 'express'
import { slugify, randomCode } from '@pavati/shared'
import { prisma } from '../../lib/prisma.js'
import { AppError, asyncHandler, ok } from '../../lib/http.js'
import { requireAuth } from '../../middleware/auth.js'
import { loadTrustContext, requirePermission, type TrustContextRequest } from '../../middleware/rbac.js'
import { validateBody } from '../../middleware/validate.js'
import { createCampaignSchema } from '@pavati/shared'
import { config } from '../../config/index.js'
import { audit } from '../../services/audit.js'

const router = Router()

router.get(
  '/public/campaigns/:slug',
  asyncHandler(async (req, res) => {
    const campaign = await prisma.paymentCampaign.findUnique({
      where: { slug: req.params.slug },
      include: { trust: true },
    })
    if (!campaign || !campaign.active) throw new AppError(404, 'Campaign not found')
    ok(res, {
      campaign: { id: campaign.id, name: campaign.name, description: campaign.description, category: campaign.category, suggestedAmounts: campaign.suggestedAmounts },
      trust: { id: campaign.trust.id, name: campaign.trust.name, logoUrl: campaign.trust.logoUrl, description: campaign.trust.description, city: campaign.trust.city, upiId: campaign.trust.upiId, festivalTypes: campaign.trust.festivalTypes, allowAnonymousDonations: campaign.trust.allowAnonymousDonations },
    })
  })
)

router.use('/:trustId/campaigns', requireAuth, loadTrustContext)

router.get(
  '/:trustId/campaigns',
  requirePermission('campaign:view'),
  asyncHandler(async (req: TrustContextRequest, res) => {
    const campaigns = await prisma.paymentCampaign.findMany({
      where: { trustId: req.trustId },
      include: { _count: { select: { donations: true } } },
      orderBy: { createdAt: 'desc' },
    })
    ok(res, campaigns.map((c) => ({ ...c, donationCount: c._count.donations, paymentUrl: `${config.webOrigin}/donate/${c.slug}` })))
  })
)

router.post(
  '/:trustId/campaigns',
  requirePermission('campaign:manage'),
  validateBody(createCampaignSchema),
  asyncHandler(async (req: TrustContextRequest, res) => {
    const body = req.body
    let slug = slugify(body.name)
    const existing = await prisma.paymentCampaign.findUnique({ where: { slug } })
    if (existing) slug = `${slug}-${randomCode(4).toLowerCase()}`
    const campaign = await prisma.paymentCampaign.create({
      data: {
        trustId: req.trustId!,
        name: body.name,
        description: body.description ?? null,
        slug,
        category: body.category ?? null,
        suggestedAmounts: body.suggestedAmounts ?? [],
      },
    })
    await audit({ actorId: req.user!.id, trustId: req.trustId, action: 'CAMPAIGN_CREATED', entityType: 'PaymentCampaign', entityId: campaign.id, metadata: { slug } })
    ok(res, { ...campaign, paymentUrl: `${config.webOrigin}/donate/${slug}` }, 201)
  })
)

router.patch(
  '/:trustId/campaigns/:campaignId',
  requirePermission('campaign:manage'),
  validateBody(createCampaignSchema.partial()),
  asyncHandler(async (req: TrustContextRequest, res) => {
    const campaign = await prisma.paymentCampaign.findFirst({ where: { id: req.params.campaignId, trustId: req.trustId } })
    if (!campaign) throw new AppError(404, 'Campaign not found')
    const body = req.body
    const updated = await prisma.paymentCampaign.update({
      where: { id: campaign.id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.category !== undefined && { category: body.category }),
        ...(body.suggestedAmounts !== undefined && { suggestedAmounts: body.suggestedAmounts }),
      },
    })
    await audit({ actorId: req.user!.id, trustId: req.trustId, action: 'CAMPAIGN_UPDATED', entityType: 'PaymentCampaign', entityId: campaign.id })
    ok(res, updated)
  })
)

router.post(
  '/:trustId/campaigns/:campaignId/toggle',
  requirePermission('campaign:manage'),
  asyncHandler(async (req: TrustContextRequest, res) => {
    const campaign = await prisma.paymentCampaign.findFirst({ where: { id: req.params.campaignId, trustId: req.trustId } })
    if (!campaign) throw new AppError(404, 'Campaign not found')
    const updated = await prisma.paymentCampaign.update({ where: { id: campaign.id }, data: { active: !campaign.active } })
    await audit({ actorId: req.user!.id, trustId: req.trustId, action: 'CAMPAIGN_TOGGLED', entityType: 'PaymentCampaign', entityId: campaign.id, metadata: { active: updated.active } })
    ok(res, updated)
  })
)

router.delete(
  '/:trustId/campaigns/:campaignId',
  requirePermission('campaign:manage'),
  asyncHandler(async (req: TrustContextRequest, res) => {
    const campaign = await prisma.paymentCampaign.findFirst({ where: { id: req.params.campaignId, trustId: req.trustId } })
    if (!campaign) throw new AppError(404, 'Campaign not found')
    await prisma.paymentCampaign.delete({ where: { id: campaign.id } })
    await audit({ actorId: req.user!.id, trustId: req.trustId, action: 'CAMPAIGN_UPDATED', entityType: 'PaymentCampaign', entityId: campaign.id, metadata: { deleted: true } })
    ok(res, { message: 'Campaign deleted' })
  })
)

export default router