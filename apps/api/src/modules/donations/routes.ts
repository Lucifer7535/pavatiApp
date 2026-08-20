import { Router } from 'express'
import { z } from '@pavati/shared'
import { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import { AppError, asyncHandler, ok } from '../../lib/http.js'
import { requireAuth } from '../../middleware/auth.js'
import { loadTrustContext, requirePermission, type TrustContextRequest } from '../../middleware/rbac.js'
import { validateBody, validateQuery } from '../../middleware/validate.js'
import { createDonationSchema, createOnlineDonationSchema, mockPaymentCompleteSchema, PAYMENT_MODE, type PaymentMode } from '@pavati/shared'
import { paymentProvider } from '../../providers/payment.js'
import { generateReceipt } from '../../services/receipts.js'
import { sendReceiptNotifications } from '../../services/notifications.js'
import { audit } from '../../services/audit.js'

const router = Router()

router.use('/:trustId/donations', requireAuth, loadTrustContext)

const listQuery = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  paymentMode: z.enum(Object.values(PAYMENT_MODE) as [string, ...string[]]).optional(),
  category: z.string().optional(),
  collectorId: z.string().uuid().optional(),
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

router.post(
  '/:trustId/donations',
  requirePermission('donation:create'),
  validateBody(createDonationSchema),
  asyncHandler(async (req: TrustContextRequest, res) => {
    const body = req.body
    const trust = await prisma.trust.findUnique({ where: { id: req.trustId! } })
    if (!trust) throw new AppError(404, 'Trust not found')

    const donation = await prisma.donation.create({
      data: {
        trustId: trust.id,
        donorName: body.donorName,
        phone: body.phone || null,
        address: body.address ?? null,
        amount: Math.round(body.amount),
        category: body.category,
        paymentMode: body.paymentMode,
        transactionRef: body.transactionRef ?? null,
        privacy: body.privacy,
        donationDate: body.paymentDate ? new Date(body.paymentDate) : new Date(),
        collectorId: req.trustMember!.id,
        status: 'SUCCEEDED',
        isOnline: false,
        notes: body.notes ?? null,
      },
    })

    const receipt = await generateReceipt({
      donationId: donation.id,
      trust,
      donation,
      collector: req.trustMember,
      collectorName: req.user!.name,
      actorId: req.user!.id,
    })

    await audit({ actorId: req.user!.id, trustId: trust.id, action: 'DONATION_CREATED', entityType: 'Donation', entityId: donation.id, metadata: { amount: donation.amount, mode: donation.paymentMode, receipt: receipt.receiptNumber } })

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

    ok(res, { donation, receipt }, 201)
  })
)

router.get(
  '/:trustId/donations',
  requirePermission('donation:view'),
  validateQuery(listQuery),
  asyncHandler(async (req: TrustContextRequest, res) => {
    const q = req.query as unknown as z.infer<typeof listQuery>
    const where: Prisma.DonationWhereInput = { trustId: req.trustId }
    if (q.from || q.to) {
      where.donationDate = {}
      if (q.from) where.donationDate.gte = new Date(q.from)
      if (q.to) where.donationDate.lte = new Date(q.to)
    }
    if (q.paymentMode) where.paymentMode = q.paymentMode as PaymentMode
    if (q.category) where.category = q.category
    if (q.collectorId) where.collectorId = q.collectorId
    if (q.q) where.donorName = { contains: q.q, mode: 'insensitive' }

    const page = q.page ?? 1
    const pageSize = q.pageSize ?? 20
    const [total, items] = await Promise.all([
      prisma.donation.count({ where }),
      prisma.donation.findMany({
        where,
        include: { receipts: { orderBy: { generatedAt: 'desc' }, take: 1 }, collector: { include: { user: true } }, campaign: true },
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
  requirePermission('donation:view'),
  asyncHandler(async (req: TrustContextRequest, res) => {
    const donation = await prisma.donation.findFirst({
      where: { id: req.params.donationId, trustId: req.trustId },
      include: { receipts: true, collector: { include: { user: true } }, campaign: true },
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

async function createPendingOnlineDonation(trustId: string, body: z.infer<typeof createOnlineDonationSchema>) {
  const trust = await prisma.trust.findUnique({ where: { id: trustId } })
  if (!trust) throw new AppError(404, 'Trust not found')
  if (body.anonymous && !trust.allowAnonymousDonations) throw new AppError(400, 'This trust does not allow anonymous donations')

  const donation = await prisma.donation.create({
    data: {
      trustId: trust.id,
      donorName: body.anonymous ? 'Anonymous Donor' : (body.donorName ?? 'Guest Donor'),
      phone: body.phone ?? null,
      email: body.email ?? null,
      amount: Math.round(body.amount),
      category: body.category,
      paymentMode: 'ONLINE',
      privacy: body.anonymous ? 'ANONYMOUS' : 'PRIVATE',
      status: 'PENDING',
      isOnline: true,
      campaignId: body.campaignId ?? null,
    },
  })
  const order = await paymentProvider.createOrder(donation.amount, donation.id)
  await prisma.paymentTransaction.create({
    data: { donationId: donation.id, provider: order.provider, orderId: order.orderId, amount: donation.amount, status: 'CREATED' },
  })
  return { trust, donation, order }
}

router.post(
  '/:trustId/payments/online',
  validateBody(createOnlineDonationSchema),
  asyncHandler(async (req: TrustContextRequest, res) => {
    const result = await createPendingOnlineDonation(req.params.trustId, req.body)
    ok(res, {
      trustId: result.trust.id,
      trustName: result.trust.name,
      trustLogo: result.trust.logoUrl,
      trustUpiId: result.trust.upiId,
      orderId: result.order.orderId,
      paymentId: `pay_${Date.now()}`,
      amount: result.donation.amount,
      donationId: result.donation.id,
      provider: result.order.provider,
    }, 201)
  })
)

router.post(
  '/mock/complete',
  validateBody(mockPaymentCompleteSchema),
  asyncHandler(async (req, res) => {
    const { orderId, paymentId } = req.body
    const tx = await prisma.paymentTransaction.findUnique({ where: { orderId } })
    if (!tx) throw new AppError(404, 'Order not found')
    if (tx.status === 'SUCCEEDED') {
      const donation = await prisma.donation.findUnique({ where: { id: tx.donationId }, include: { trust: true, collector: true } })
      const receipt = await prisma.receipt.findFirst({ where: { donationId: tx.donationId } })
      return ok(res, { alreadyProcessed: true, donation, receipt })
    }
    await prisma.$transaction(async (t) => {
      await t.paymentTransaction.update({ where: { id: tx.id }, data: { status: 'SUCCEEDED', paymentId, webhookVerified: true } })
      return t.donation.update({ where: { id: tx.donationId }, data: { status: 'SUCCEEDED' } })
    })
    const donation = await prisma.donation.findUnique({ where: { id: tx.donationId }, include: { trust: true } })
    const trust = donation!.trust
    const receipt = await generateReceipt({ donationId: donation!.id, trust, donation: donation! })
    await audit({ actorId: null, trustId: trust.id, action: 'DONATION_CREATED', entityType: 'Donation', entityId: donation!.id, metadata: { amount: donation!.amount, mode: 'ONLINE', orderId } })
    await sendReceiptNotifications({
      trustId: trust.id,
      donorName: donation!.donorName,
      donorPhone: donation!.phone,
      donorEmail: donation!.email,
      amount: donation!.amount,
      receiptNumber: receipt.receiptNumber,
      receiptVerificationToken: receipt.verificationToken,
      channels: { sms: trust.notificationSms, whatsapp: trust.notificationWhatsapp, email: trust.notificationEmail },
    })
    ok(res, { success: true, donation, receipt, verificationUrl: `/receipt/verify/${receipt.verificationToken}` })
  })
)

router.post(
  '/webhook',
  asyncHandler(async (req, res) => {
    const signature = req.headers['x-razorpay-signature'] as string | undefined
    if (!signature) throw new AppError(400, 'Missing webhook signature')
    const event = req.body?.event
    const orderId = req.body?.payload?.order?.entity?.id as string | undefined
    if (!orderId) throw new AppError(400, 'Missing order id in payload')
    const tx = await prisma.paymentTransaction.findUnique({ where: { orderId } })
    if (!tx) throw new AppError(404, 'Order not found')
    await prisma.paymentTransaction.update({ where: { id: tx.id }, data: { status: event === 'payment.captured' ? 'SUCCEEDED' : 'FAILED', webhookVerified: true, providerResponse: req.body } })
    if (event === 'payment.captured') {
      await prisma.donation.update({ where: { id: tx.donationId }, data: { status: 'SUCCEEDED' } })
    }
    ok(res, { received: true })
  })
)

export default router