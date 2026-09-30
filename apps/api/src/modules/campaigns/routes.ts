import { Router } from 'express'
import { slugify, randomCode } from '@pavati/shared'
import { prisma } from '../../lib/prisma.js'
import { donationVisibilityFilter } from '../../lib/access.js'
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
      // Archived campaigns keep their slug for attribution, so the public donation
      // link must treat deletedAt as terminal rather than relying on `active` alone.
      select: {
        id: true, name: true, description: true, category: true, suggestedAmounts: true, qrCodeUrl: true, active: true, deletedAt: true,
        trust: { select: { id: true, name: true, logoUrl: true, description: true, city: true, upiId: true, festivalTypes: true, allowAnonymousDonations: true } },
      },
    })
    if (!campaign || !campaign.active || campaign.deletedAt) throw new AppError(404, 'Campaign not found')
    ok(res, {
      campaign: { id: campaign.id, name: campaign.name, description: campaign.description, category: campaign.category, suggestedAmounts: campaign.suggestedAmounts, qrCodeUrl: campaign.qrCodeUrl },
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
      where: { trustId: req.trustId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    })

    // The donation total is itself privacy-sensitive. An unrestricted `_count` summed
    // ANONYMOUS and RESTRICTED donations, so a role holding campaign:view but not
    // donation:view could still infer how many private donations a campaign attracted —
    // and the total did not match what the donations list would show them.
    const canViewAllDonations = !!req.effectivePermissions?.includes('donation:view')
    const member = req.trustMember!
    const counts = canViewAllDonations
      ? await prisma.donation.groupBy({
          by: ['campaignId'],
          where: { campaignId: { in: campaigns.map((c) => c.id) }, status: 'SUCCEEDED' },
          _count: { _all: true },
        })
      : await prisma.donation.groupBy({
          by: ['campaignId'],
          where: {
            campaignId: { in: campaigns.map((c) => c.id) },
            status: 'SUCCEEDED',
            ...donationVisibilityFilter(member),
          },
          _count: { _all: true },
        })
    const countById = new Map(counts.map((row) => [row.campaignId, row._count._all]))

    ok(res, campaigns.map((c) => ({ ...c, donationCount: countById.get(c.id) ?? 0, paymentUrl: `${config.webOrigin}/donate/${c.slug}` })))
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
        qrCodeUrl: body.qrCodeUrl ?? null,
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
    const campaign = await prisma.paymentCampaign.findFirst({ where: { id: req.params.campaignId, trustId: req.trustId, deletedAt: null } })
    if (!campaign) throw new AppError(404, 'Campaign not found')
    const body = req.body
    const updated = await prisma.paymentCampaign.update({
      where: { id: campaign.id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.category !== undefined && { category: body.category }),
        ...(body.suggestedAmounts !== undefined && { suggestedAmounts: body.suggestedAmounts }),
        ...(body.qrCodeUrl !== undefined && { qrCodeUrl: body.qrCodeUrl }),
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
    const campaign = await prisma.paymentCampaign.findFirst({ where: { id: req.params.campaignId, trustId: req.trustId, deletedAt: null } })
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
    const campaign = await prisma.paymentCampaign.findFirst({
      where: { id: req.params.campaignId, trustId: req.trustId, deletedAt: null },
    })
    if (!campaign) throw new AppError(404, 'Campaign not found')

    // Archive, do not delete. Donation.campaignId is `onDelete: SetNull`, so a hard
    // DELETE would silently drop the campaign attribution from every donation ever
    // recorded against it — including receipts already issued and published — with no
    // record that it had ever been linked.
    const archived = await prisma.paymentCampaign.update({
      where: { id: campaign.id },
      data: { deletedAt: new Date(), active: false },
    })
    await audit({
      actorId: req.user!.id,
      trustId: req.trustId,
      action: 'CAMPAIGN_UPDATED',
      entityType: 'PaymentCampaign',
      entityId: campaign.id,
      metadata: { archived: true, slug: campaign.slug },
    })
    ok(res, { message: 'Campaign archived', campaign: { id: archived.id, slug: archived.slug, active: archived.active, deletedAt: archived.deletedAt } })
  })
)

export default router