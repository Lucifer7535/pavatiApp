import { Router } from 'express'
import { z, OFFICIAL_ROLES, type TrustRole } from '@pavati/shared'
import { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import { AppError, asyncHandler, ok } from '../../lib/http.js'
import { requireAuth, type AuthedRequest } from '../../middleware/auth.js'
import { loadTrustContext, requirePermission, type TrustContextRequest } from '../../middleware/rbac.js'
import { validateBody, validateQuery } from '../../middleware/validate.js'
import { generateReceipt, verifyReceiptData } from '../../services/receipts.js'
import { buildReceiptMessage } from '../../services/notifications.js'
import { emailProvider } from '../../providers/messaging.js'
import { audit } from '../../services/audit.js'
import { fileFromUrl } from '../../providers/storage.js'
import { config } from '../../config/index.js'

const router = Router()

const listQuery = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  status: z.enum(['ACTIVE', 'VOID']).optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

router.use('/:trustId/receipts', requireAuth, loadTrustContext)

router.get(
  '/:trustId/receipts',
  requirePermission(['receipt:view', 'donation:view_own']),
  validateQuery(listQuery),
  asyncHandler(async (req: TrustContextRequest, res) => {
    const q = req.query as unknown as z.infer<typeof listQuery>
    const member = req.trustMember!
    const ownOnly = !req.effectivePermissions?.includes('receipt:view') && !req.effectivePermissions?.includes('donation:view')
    const isOfficial = OFFICIAL_ROLES.includes(member.role as TrustRole)
    const donationFilter: Prisma.DonationWhereInput = {
      ...(ownOnly ? { submittedById: member.id } : {}),
      ...(isOfficial ? {} : { OR: [{ privacy: 'PUBLIC' }, { submittedById: member.id }, { collectorId: member.id }] }),
    }
    const where: Prisma.ReceiptWhereInput = { trustId: req.trustId, donation: donationFilter }
    if (q.status) where.status = q.status
    if (q.search) {
      where.OR = [
        { receiptNumber: { contains: q.search, mode: 'insensitive' } },
        { donation: { is: { donorName: { contains: q.search, mode: 'insensitive' } } } },
      ]
    }
    if (q.from || q.to) {
      where.generatedAt = {}
      if (q.from) where.generatedAt.gte = new Date(q.from)
      if (q.to) where.generatedAt.lte = new Date(q.to)
    }
    const page = q.page ?? 1
    const pageSize = q.pageSize ?? 20
    const [total, rawItems] = await Promise.all([
      prisma.receipt.count({ where }),
      prisma.receipt.findMany({
        where,
        include: { donation: { include: { submitter: { include: { user: true } } } }, template: { select: { name: true } } },
        orderBy: { generatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ])
    const items = rawItems.map((r) => {
      if (r.donation && !r.donation.email && r.donation.submitter?.user?.email) {
        return { ...r, donation: { ...r.donation, email: r.donation.submitter.user.email } }
      }
      return r
    })
    ok(res, { total, page, pageSize, items })
  })
)

router.post(
  '/:trustId/receipts',
  requirePermission('receipt:create'),
  validateBody(z.object({ donationId: z.string().uuid(), templateId: z.string().uuid().optional(), reason: z.string().optional() })),
  asyncHandler(async (req: TrustContextRequest, res) => {
    const donation = await prisma.donation.findFirst({ where: { id: req.body.donationId, trustId: req.trustId } })
    if (!donation) throw new AppError(404, 'Donation not found')
    const trust = await prisma.trust.findUnique({ where: { id: req.trustId } })
    if (!trust) throw new AppError(404, 'Trust not found')
    const collector = await prisma.trustMember.findUnique({ where: { id: donation.collectorId ?? '' }, include: { user: true } })
    const receipt = await generateReceipt({ donationId: donation.id, trust, donation, collector, actorId: req.user!.id, templateId: req.body.templateId })
    await audit({ actorId: req.user!.id, trustId: req.trustId, action: 'RECEIPT_CREATED', entityType: 'Receipt', entityId: receipt.id, metadata: { reason: req.body.reason ?? 'reprint' } })
    ok(res, receipt, 201)
  })
)

router.get(
  '/:trustId/receipts/:receiptId',
  requirePermission(['receipt:view', 'donation:view_own']),
  asyncHandler(async (req: TrustContextRequest, res) => {
    const member = req.trustMember!
    const isOfficial = OFFICIAL_ROLES.includes(member.role as TrustRole)
    const receipt = await prisma.receipt.findFirst({
      where: {
        id: req.params.receiptId,
        trustId: req.trustId,
        ...(isOfficial ? {} : { donation: { OR: [{ privacy: 'PUBLIC' }, { submittedById: member.id }, { collectorId: member.id }] } }),
      },
      include: { donation: true, template: { select: { name: true } } },
    })
    if (!receipt) throw new AppError(404, 'Receipt not found')
    ok(res, receipt)
  })
)

router.patch(
  '/:trustId/receipts/:receiptId/phone',
  requirePermission('receipt:view'),
  validateBody(z.object({ phone: z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number') })),
  asyncHandler(async (req: TrustContextRequest, res) => {
    const receipt = await prisma.receipt.findFirst({
      where: { id: req.params.receiptId, trustId: req.trustId },
      include: { donation: true },
    })
    if (!receipt) throw new AppError(404, 'Receipt not found')
    if (!receipt.donation) throw new AppError(400, 'Donation not found for this receipt')
    const donation = await prisma.donation.update({
      where: { id: receipt.donationId },
      data: { phone: req.body.phone },
    })
    await audit({ actorId: req.user!.id, trustId: req.trustId!, action: 'SETTINGS_UPDATED', entityType: 'Receipt', entityId: receipt.id, metadata: { action: 'add_phone', phone: req.body.phone } })
    ok(res, { donation })
  })
)

router.post(
  '/:trustId/receipts/:receiptId/void',
  requirePermission('receipt:void'),
  validateBody(z.object({ reason: z.string().min(2) })),
  asyncHandler(async (req: TrustContextRequest, res) => {
    const receipt = await prisma.receipt.findFirst({ where: { id: req.params.receiptId, trustId: req.trustId } })
    if (!receipt) throw new AppError(404, 'Receipt not found')
    await prisma.receipt.update({
      where: { id: receipt.id },
      data: { status: 'VOID', voidedById: req.user!.id, voidReason: req.body.reason },
    })
    await audit({ actorId: req.user!.id, trustId: req.trustId, action: 'RECEIPT_VOIDED', entityType: 'Receipt', entityId: receipt.id, metadata: { reason: req.body.reason } })
    ok(res, { message: 'Receipt voided' })
  })
)

router.post(
  '/:trustId/receipts/:receiptId/send',
  requirePermission('receipt:view'),
  validateBody(z.object({ channels: z.array(z.enum(['email'])).min(1) })),
  asyncHandler(async (req: TrustContextRequest, res) => {
    const receipt = await prisma.receipt.findFirst({
      where: { id: req.params.receiptId, trustId: req.trustId },
      include: { donation: true },
    })
    if (!receipt) throw new AppError(404, 'Receipt not found')
    if (receipt.status !== 'ACTIVE') throw new AppError(400, 'Receipt is not active')
    if (!receipt.donation) throw new AppError(400, 'Donation not found for this receipt')

    const sent: string[] = []

    let donorEmail = receipt.donation.email ?? null
    if (!donorEmail && receipt.donation.submittedById) {
      const submitter = await prisma.trustMember.findUnique({
        where: { id: receipt.donation.submittedById },
        include: { user: true },
      })
      donorEmail = submitter?.user.email ?? null
    }

    for (const channel of req.body.channels) {
      if (channel === 'email') {
        const email = donorEmail
        if (!email) continue
        const message = buildReceiptMessage({
          amount: receipt.donation.amount,
          receiptNumber: receipt.receiptNumber,
          receiptVerificationToken: receipt.verificationToken,
        })
        const result = await emailProvider.send(email, message, `${config.webOrigin}/receipt/verify/${receipt.verificationToken}`)
        await prisma.notification.create({
          data: {
            trustId: req.trustId!,
            recipientEmail: email,
            channel: 'EMAIL',
            message,
            status: result.ok ? 'SENT' : 'FAILED',
            providerResponse: result.providerResponse,
          },
        })
        if (result.ok) sent.push('email')
      }
    }

    await audit({ actorId: req.user!.id, trustId: req.trustId!, action: 'SETTINGS_UPDATED', entityType: 'Receipt', entityId: receipt.id, metadata: { action: 'manual_send', channels: req.body.channels, sent } })

    ok(res, { sent })
  })
)

router.get(
  '/receipts/:receiptId/pdf',
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const receipt = await prisma.receipt.findUnique({ where: { id: req.params.receiptId } })
    if (!receipt || receipt.status !== 'ACTIVE') throw new AppError(404, 'Receipt not found')
    const member = await prisma.trustMember.findUnique({
      where: { trustId_userId: { trustId: receipt.trustId, userId: req.user!.id } },
    })
    const isTrustMember = member && member.status === 'ACTIVE'
    let isDonor = false
    if (req.user!.phone) {
      isDonor = !!(await prisma.donation.findFirst({ where: { id: receipt.donationId, phone: req.user!.phone } }))
    }
    if (!isTrustMember && !isDonor) throw new AppError(403, 'Not authorized to view this receipt')
    if (!receipt.pdfUrl) throw new AppError(404, 'PDF not generated')
    const file = await fileFromUrl(receipt.pdfUrl)
    if (!file) throw new AppError(404, 'PDF file missing')
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${receipt.receiptNumber}.pdf"`)
    res.send(file.buffer)
  })
)

router.get(
  '/receipt/verify/:token',
  asyncHandler(async (req, res) => {
    const data = await verifyReceiptData(req.params.token)
    if (!data) throw new AppError(404, 'Receipt not found or invalid verification link')
    ok(res, data)
  })
)

export default router