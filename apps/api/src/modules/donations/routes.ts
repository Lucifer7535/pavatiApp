import { Router } from 'express'
import { z } from '@pavati/shared'
import { Prisma, type DonationStatus, type Trust } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import { AppError, asyncHandler, ok } from '../../lib/http.js'
import { requireAuth } from '../../middleware/auth.js'
import { loadTrustContext, requirePermission, type TrustContextRequest } from '../../middleware/rbac.js'
import { validateBody, validateQuery } from '../../middleware/validate.js'
import { createDonationSchema, selfDonationSchema, PAYMENT_MODE, OFFICIAL_ROLES, type PaymentMode, type TrustRole } from '@pavati/shared'
import { generateReceipt } from '../../services/receipts.js'
import { sendReceiptNotifications, buildReceiptWhatsAppUrl } from '../../services/notifications.js'
import { audit } from '../../services/audit.js'

const router = Router()

router.use(['/:trustId/donations', '/:trustId/my-donations'], requireAuth, loadTrustContext)

const listQuery = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  paymentMode: z.enum(Object.values(PAYMENT_MODE) as [string, ...string[]]).optional(),
  status: z.enum(['PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED', 'CANCELLED']).optional(),
  category: z.string().optional(),
  collectorId: z.string().uuid().optional(),
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

type InputSplit = { paymentMode: PaymentMode; amount: number; transactionRef?: string | null; proofUrl?: string | null }

function resolveSplits(body: z.infer<typeof createDonationSchema>): InputSplit[] {
  if (body.splits?.length) return body.splits as InputSplit[]
  return [{ paymentMode: (body.paymentMode ?? 'CASH') as PaymentMode, amount: body.amount, transactionRef: body.transactionRef ?? null, proofUrl: null }]
}

async function issueReceiptForDonation(trust: Trust, donationId: string, actorId?: string | null) {
  const donation = await prisma.donation.findUniqueOrThrow({ where: { id: donationId } })
  const collector = donation.collectorId
    ? await prisma.trustMember.findUnique({ where: { id: donation.collectorId }, include: { user: true } })
    : null
  const receipt = await generateReceipt({
    donationId: donation.id,
    trust,
    donation,
    collector,
    actorId,
  })
  await audit({ actorId: actorId ?? null, trustId: trust.id, action: 'DONATION_VERIFIED', entityType: 'Donation', entityId: donation.id, metadata: { amount: donation.amount, receipt: receipt.receiptNumber } })
  await sendReceiptNotifications({
    trustId: trust.id,
    donorName: donation.donorName,
    donorPhone: donation.phone,
    donorEmail: null,
    amount: donation.amount,
    receiptNumber: receipt.receiptNumber,
    receiptVerificationToken: receipt.verificationToken,
    channels: { sms: trust.notificationSms, whatsapp: trust.notificationWhatsapp, email: trust.notificationEmail },
  })
  return receipt
}

router.post(
  '/:trustId/donations',
  requirePermission('donation:create'),
  validateBody(createDonationSchema),
  asyncHandler(async (req: TrustContextRequest, res) => {
    const body = req.body
    const trust = await prisma.trust.findUnique({ where: { id: req.trustId! } })
    if (!trust) throw new AppError(404, 'Trust not found')

    let campaignId: string | null = null
    if (body.campaignId) {
      const campaign = await prisma.paymentCampaign.findFirst({ where: { id: body.campaignId, trustId: trust.id } })
      if (!campaign) throw new AppError(400, 'Payment link not found')
      campaignId = campaign.id
    }

    const inputSplits = resolveSplits(body)
    const distinctModes = new Set(inputSplits.map((s) => s.paymentMode))
    const paymentMode = (distinctModes.size > 1 ? 'MIXED' : inputSplits[0].paymentMode) as PaymentMode
    const now = new Date()
    const donationStatus = body.awaitingPayment && inputSplits.some((s) => s.paymentMode !== 'CASH') ? 'PENDING' : 'SUCCEEDED'

    const donation = await prisma.donation.create({
      data: {
        trustId: trust.id,
        donorName: body.donorName,
        phone: body.phone || null,
        email: body.email || null,
        address: body.address ?? null,
        amount: Math.round(body.amount),
        category: body.category,
        paymentMode: paymentMode as never,
        transactionRef: inputSplits.length === 1 ? inputSplits[0].transactionRef ?? null : null,
        privacy: body.privacy,
        donationDate: body.paymentDate ? new Date(body.paymentDate) : new Date(),
        collectorId: req.trustMember!.id,
        status: donationStatus,
        isOnline: false,
        notes: body.notes ?? null,
        campaignId,
        splits: {
          create: inputSplits.map((s) => ({
            paymentMode: s.paymentMode as never,
            amount: Math.round(s.amount),
            transactionRef: s.transactionRef ?? null,
            proofUrl: s.proofUrl ?? null,
            verifiedAt: s.paymentMode === 'CASH' || !body.awaitingPayment ? now : null,
            verifiedById: s.paymentMode === 'CASH' || !body.awaitingPayment ? req.trustMember!.id : null,
          })),
        },
      },
      include: { splits: true },
    })

    let receipt: Awaited<ReturnType<typeof generateReceipt>> | null = null
    let whatsappShareUrl: string | null = null

    if (donation.status === 'SUCCEEDED') {
      receipt = await generateReceipt({
        donationId: donation.id,
        trust,
        donation,
        collector: req.trustMember,
        collectorName: req.user!.name,
        actorId: req.user!.id,
      })
      whatsappShareUrl = buildReceiptWhatsAppUrl({ donorPhone: donation.phone, amount: donation.amount, receiptNumber: receipt.receiptNumber, receiptVerificationToken: receipt.verificationToken }, trust.notificationWhatsapp)
    }

    await audit({ actorId: req.user!.id, trustId: trust.id, action: 'DONATION_CREATED', entityType: 'Donation', entityId: donation.id, metadata: { amount: donation.amount, mode: donation.paymentMode, status: donation.status, receipt: receipt?.receiptNumber ?? null } })

    if (receipt) {
      await sendReceiptNotifications({
        trustId: trust.id,
        donorName: donation.donorName,
        donorPhone: donation.phone,
        donorEmail: null,
        amount: donation.amount,
        receiptNumber: receipt.receiptNumber,
        receiptVerificationToken: receipt.verificationToken,
        channels: { sms: trust.notificationSms, whatsapp: trust.notificationWhatsapp, email: trust.notificationEmail },
      })
    }

    ok(res, { donation, receipt, whatsappShareUrl }, 201)
  })
)

router.get(
  '/:trustId/donations',
  requirePermission(['donation:view', 'donation:view_own']),
  validateQuery(listQuery),
  asyncHandler(async (req: TrustContextRequest, res) => {
    const q = req.query as unknown as z.infer<typeof listQuery>
    const member = req.trustMember!
    const ownOnly = !req.effectivePermissions?.includes('donation:view')
    const isOfficial = OFFICIAL_ROLES.includes(member.role as TrustRole)
    const where: Prisma.DonationWhereInput = { trustId: req.trustId }
    if (ownOnly) where.submittedById = member.id
    if (!isOfficial) {
      where.AND = [{ OR: [{ privacy: 'PUBLIC' }, { submittedById: member.id }, { collectorId: member.id }] }]
    }
    if (q.from || q.to) {
      where.donationDate = {}
      if (q.from) where.donationDate.gte = new Date(q.from)
      if (q.to) where.donationDate.lte = new Date(q.to)
    }
    if (q.paymentMode) where.paymentMode = q.paymentMode as PaymentMode
    if (q.status) where.status = q.status as DonationStatus
    if (q.category) where.category = q.category
    if (q.collectorId) where.collectorId = q.collectorId
    if (q.q) where.donorName = { contains: q.q, mode: 'insensitive' }

    const page = q.page ?? 1
    const pageSize = q.pageSize ?? 20
    const [total, items] = await Promise.all([
      prisma.donation.count({ where }),
      prisma.donation.findMany({
        where,
        include: { receipts: { orderBy: { generatedAt: 'desc' }, take: 1 }, collector: { include: { user: true } }, campaign: true, splits: { orderBy: { createdAt: 'asc' } } },
        orderBy: { donationDate: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ])
    ok(res, { total, page, pageSize, items })
  })
)

router.get(
  '/:trustId/donations/:donationId',
  requirePermission(['donation:view', 'donation:view_own']),
  asyncHandler(async (req: TrustContextRequest, res) => {
    const member = req.trustMember!
    const ownOnly = !req.effectivePermissions?.includes('donation:view')
    const isOfficial = OFFICIAL_ROLES.includes(member.role as TrustRole)
    const donation = await prisma.donation.findFirst({
      where: {
        id: req.params.donationId,
        trustId: req.trustId,
        ...(ownOnly ? { submittedById: member.id } : {}),
        ...(isOfficial ? {} : { OR: [{ privacy: 'PUBLIC' }, { submittedById: member.id }, { collectorId: member.id }] }),
      },
      include: { receipts: true, collector: { include: { user: true } }, campaign: true, splits: { orderBy: { createdAt: 'asc' }, include: { verifiedBy: { include: { user: true } } } } },
    })
    if (!donation) throw new AppError(404, 'Donation not found')
    ok(res, donation)
  })
)

router.post(
  '/:trustId/donations/:donationId/void',
  requirePermission('donation:void'),
  validateBody(z.object({ reason: z.string().min(2).optional() })),
  asyncHandler(async (req: TrustContextRequest, res) => {
    const donation = await prisma.donation.findFirst({ where: { id: req.params.donationId, trustId: req.trustId } })
    if (!donation) throw new AppError(404, 'Donation not found')
    await prisma.$transaction([
      prisma.donation.update({ where: { id: donation.id }, data: { status: 'CANCELLED' } }),
      prisma.receipt.updateMany({ where: { donationId: donation.id }, data: { status: 'VOID' } }),
    ])
    await audit({ actorId: req.user!.id, trustId: req.trustId, action: 'DONATION_VOIDED', entityType: 'Donation', entityId: donation.id, metadata: { reason: req.body.reason ?? null } })
    ok(res, { message: 'Donation and receipts voided' })
  })
)

router.post(
  '/:trustId/donations/:donationId/splits/:splitId/verify',
  requirePermission('donation:verify'),
  asyncHandler(async (req: TrustContextRequest, res) => {
    const donation = await prisma.donation.findFirst({
      where: { id: req.params.donationId, trustId: req.trustId },
      include: { splits: true },
    })
    if (!donation) throw new AppError(404, 'Donation not found')
    if (donation.status === 'CANCELLED') throw new AppError(400, 'Donation is voided')
    const split = donation.splits.find((s) => s.id === req.params.splitId)
    if (!split) throw new AppError(404, 'Payment split not found')
    if (split.verifiedAt) throw new AppError(400, 'Split already verified')

    await prisma.donationSplit.update({
      where: { id: split.id },
      data: { verifiedAt: new Date(), verifiedById: req.trustMember!.id },
    })

    let receipt = null
    const remaining = await prisma.donationSplit.count({ where: { donationId: donation.id, verifiedAt: null } })
    if (remaining === 0 && donation.status === 'PENDING') {
      await prisma.donation.update({ where: { id: donation.id }, data: { status: 'SUCCEEDED' } })
      const trust = await prisma.trust.findUniqueOrThrow({ where: { id: req.trustId! } })
      receipt = await issueReceiptForDonation(trust, donation.id, req.user!.id)
    }

    const result = await prisma.donation.findUnique({ where: { id: donation.id }, include: { splits: { orderBy: { createdAt: 'asc' }, include: { verifiedBy: { include: { user: true } } } } } })
    ok(res, { donation: result, receipt })
  })
)

router.post(
  '/:trustId/my-donations',
  requirePermission('donate'),
  validateBody(selfDonationSchema),
  asyncHandler(async (req: TrustContextRequest, res) => {
    const body = req.body as z.infer<typeof selfDonationSchema>
    const trust = await prisma.trust.findUnique({ where: { id: req.trustId! } })
    if (!trust) throw new AppError(404, 'Trust not found')

    let campaignId: string | null = null
    if (body.campaignId) {
      const campaign = await prisma.paymentCampaign.findFirst({ where: { id: body.campaignId, trustId: trust.id } })
      if (!campaign) throw new AppError(400, 'Payment link not found')
      campaignId = campaign.id
    }

    const donation = await prisma.donation.create({
      data: {
        trustId: trust.id,
        donorName: req.user!.name,
        phone: req.user!.phone ?? null,
        email: req.user!.email ?? null,
        amount: Math.round(body.amount),
        category: body.category ?? 'General Donation',
        paymentMode: 'UPI',
        transactionRef: body.transactionRef ?? null,
        privacy: body.privacy,
        donationDate: new Date(),
        status: 'PENDING',
        isOnline: true,
        campaignId,
        submittedById: req.trustMember!.id,
        splits: {
          create: [{
            paymentMode: 'UPI',
            amount: Math.round(body.amount),
            transactionRef: body.transactionRef ?? null,
            proofUrl: body.proofUrl ?? null,
          }],
        },
      },
      include: { splits: true, campaign: true },
    })

    await audit({ actorId: req.user!.id, trustId: trust.id, action: 'DONATION_SUBMITTED', entityType: 'Donation', entityId: donation.id, metadata: { amount: donation.amount } })
    ok(res, { donation }, 201)
  })
)

export default router
