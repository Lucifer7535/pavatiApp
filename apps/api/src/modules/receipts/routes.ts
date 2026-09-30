import { Router } from 'express'
import { z } from '@pavati/shared'
import { Prisma } from '@prisma/client'
import rateLimit from 'express-rate-limit'
import { prisma, prismaPublic } from '../../lib/prisma.js'
import { donationVisibilityFilter, isOfficialMember } from '../../lib/access.js'
import { AppError, asyncHandler, ok } from '../../lib/http.js'
import { requireAuth, type AuthedRequest } from '../../middleware/auth.js'
import { loadTrustContext, requirePermission, type TrustContextRequest } from '../../middleware/rbac.js'
import { validateBody, validateParams, validateQuery } from '../../middleware/validate.js'
import { generateReceipt, reprintReceiptPdf, verifyReceiptData } from '../../services/receipts.js'
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

const receiptParams = z.object({ trustId: z.string().uuid(), receiptId: z.string().uuid() })

/** Credential-free submitter select. */
const USER_SELECT = { id: true, name: true, profileImage: true, email: true } as const

/**
 * Bounds how fast one caller can drive the trust's mailer. The emailed link is a
 * deliberately public single-receipt artefact; the abuse risk is volume, not content.
 */
const receiptSendLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many receipt emails sent. Please try again later.' },
})

router.use('/:trustId/receipts', requireAuth, loadTrustContext)

router.get(
  '/:trustId/receipts',
  requirePermission(['receipt:view', 'donation:view_own']),
  validateQuery(listQuery),
  asyncHandler(async (req: TrustContextRequest, res) => {
    const q = req.query as unknown as z.infer<typeof listQuery>
    const member = req.trustMember!
    const donationFilter = donationVisibilityFilter(member)
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
      prismaPublic.receipt.count({ where }),
      prismaPublic.receipt.findMany({
        where,
        select: {
          id: true,
          receiptNumber: true,
          donationId: true,
          trustId: true,
          templateId: true,
          pdfUrl: true,
          status: true,
          voidedById: true,
          voidReason: true,
          generatedAt: true,
          // `verificationToken` is a business bearer on the Receipt row, not a
          // credential column, so the deep-walking strip does not remove it. It is
          // deliberately absent from this root select: the public verification link
          // is the only place that needs it, and returning it here would hand every
          // member a live bearer for every other member's receipts. Send-by-email and
          // the public verify route read it internally.
          donation: {
            select: {
              id: true, amount: true, donorName: true, phone: true, email: true,
              status: true, privacy: true, paymentMode: true, category: true,
              transactionRef: true, donationDate: true,
              submitter: { select: { id: true, position: true, user: { select: USER_SELECT } } },
            },
          },
          template: { select: { name: true } },
        },
        orderBy: { generatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ])
    // Preserve the existing behaviour of showing the submitter's account address when the
    // donation was recorded without one, so a logged-in donor's receipts still offer the
    // email channel. POST /receipts/:id/send resolves the recipient internally as well.
    const items = rawItems.map((r) =>
      r.donation && !r.donation.email && r.donation.submitter?.user?.email
        ? { ...r, donation: { ...r.donation, email: r.donation.submitter.user.email } }
        : r,
    )
    ok(res, { total, page, pageSize, items })
  })
)

router.post(
  '/:trustId/receipts',
  requirePermission('receipt:create'),
  validateBody(z.object({ donationId: z.string().uuid(), templateId: z.string().uuid().optional(), reason: z.string().optional() })),
  asyncHandler(async (req: TrustContextRequest, res) => {
    const member = req.trustMember!
    const donation = await prismaPublic.donation.findFirst({
      where: {
        id: req.body.donationId,
        trustId: req.trustId,
        // Only a settled, payable donation may carry a receipt.
        status: 'SUCCEEDED',
        ...(isOfficialMember(member) ? {} : { OR: [{ privacy: 'PUBLIC' }, { submittedById: member.id }, { collectorId: member.id }] }),
      },
    })
    if (!donation) throw new AppError(400, 'Receipts can only be issued for a completed donation')

    // Defence in depth alongside the helper's own trust scoping.
    if (req.body.templateId) {
      const scoped = await prismaPublic.receiptTemplate.findFirst({ where: { id: req.body.templateId, trustId: req.trustId } })
      if (!scoped) throw new AppError(404, 'Template not found')
    }

    // Reissuing over an existing receipt must not be able to undo a void.
    const existing = await prisma.receipt.findFirst({
      where: { donationId: donation.id, trustId: req.trustId },
      orderBy: { generatedAt: 'desc' },
    })
    if (existing) {
      if (!req.effectivePermissions?.includes('receipt:reprint')) {
        throw new AppError(403, 'Missing permission: receipt:reprint')
      }

      // Reprint of a live receipt reuses the existing row, receipt number and
      // verification token. Minting a second ACTIVE receipt instead would leave the
      // previously issued public link resolving to a stale duplicate, burn a receipt
      // number, and hand the donor two independently valid tokens for one donation.
      if (existing.status === 'ACTIVE') {
        const trust = await prisma.trust.findUnique({ where: { id: req.trustId } })
        if (!trust) throw new AppError(404, 'Trust not found')

        const templateId = req.body.templateId ?? existing.templateId
        const refreshed = await reprintReceiptPdf(existing.id, templateId)
        await audit({
          actorId: req.user!.id,
          trustId: req.trustId,
          action: 'RECEIPT_CREATED',
          entityType: 'Receipt',
          entityId: existing.id,
          metadata: { reason: req.body.reason ?? 'reprint', reusedReceiptNumber: refreshed.receiptNumber },
        })
        return ok(res, refreshed)
      }

      // The only receipt here is a voided one. Restoring it is a deliberate
      // `receipt:void`-level act, and the voided row is left VOID so the old public
      // link keeps reporting VOID rather than silently becoming valid again.
      if (!req.effectivePermissions?.includes('receipt:void')) {
        throw new AppError(409, 'This donation has a voided receipt; a receipt:void holder must authorise reissue')
      }
    }

    const trust = await prisma.trust.findUnique({ where: { id: req.trustId } })
    if (!trust) throw new AppError(404, 'Trust not found')
    const collector = await prisma.trustMember.findUnique({ where: { id: donation.collectorId ?? '' }, include: { user: { select: { name: true } } } })
    const receipt = await generateReceipt({ donationId: donation.id, trust, donation, collector, actorId: req.user!.id, templateId: req.body.templateId })
    await audit({ actorId: req.user!.id, trustId: req.trustId, action: 'RECEIPT_CREATED', entityType: 'Receipt', entityId: receipt.id, metadata: { reason: req.body.reason ?? (existing ? 'reprint' : 'issue') } })
    ok(res, receipt, 201)
  })
)

router.get(
  '/:trustId/receipts/:receiptId',
  requirePermission(['receipt:view', 'donation:view_own']),
  validateParams(receiptParams),
  asyncHandler(async (req: TrustContextRequest, res) => {
    const member = req.trustMember!
    const receipt = await prismaPublic.receipt.findFirst({
      where: {
        id: req.params.receiptId,
        trustId: req.trustId,
        donation: donationVisibilityFilter(member),
      },
      // verificationToken omitted for the same reason as the list route.
      select: {
        id: true, receiptNumber: true, status: true, generatedAt: true,
        voidedById: true, voidReason: true, pdfUrl: true, templateId: true, donationId: true,
        donation: { include: { collector: { select: { id: true, position: true } }, campaign: { select: { id: true, name: true } } } },
        template: { select: { name: true } },
      },
    })
    if (!receipt) throw new AppError(404, 'Receipt not found')
    ok(res, receipt)
  })
)

router.patch(
  '/:trustId/receipts/:receiptId/phone',
  requirePermission('donation:create'),
  validateParams(receiptParams),
  validateBody(z.object({ phone: z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number') })),
  asyncHandler(async (req: TrustContextRequest, res) => {
    const member = req.trustMember!
    // A write to a donor contact field on a financial record: write-class permission,
    // and the object-level scope the read paths use.
    const receipt = await prismaPublic.receipt.findFirst({
      where: {
        id: req.params.receiptId,
        trustId: req.trustId,
        ...(isOfficialMember(member) ? {} : { donation: { OR: [{ submittedById: member.id }, { collectorId: member.id }] } }),
      },
      select: { id: true, receiptNumber: true, donationId: true },
    })
    if (!receipt) throw new AppError(404, 'Receipt not found')
    const donation = await prismaPublic.donation.update({
      where: { id: receipt.donationId },
      data: { phone: req.body.phone },
      select: { id: true, amount: true, phone: true },
    })
    await audit({ actorId: req.user!.id, trustId: req.trustId!, action: 'SETTINGS_UPDATED', entityType: 'Receipt', entityId: receipt.id, metadata: { action: 'add_phone', phone: req.body.phone } })
    ok(res, { phone: donation.phone })
  })
)

router.post(
  '/:trustId/receipts/:receiptId/void',
  requirePermission('receipt:void'),
  validateParams(receiptParams),
  validateBody(z.object({ reason: z.string().min(2) })),
  asyncHandler(async (req: TrustContextRequest, res) => {
    const receipt = await prismaPublic.receipt.findFirst({ where: { id: req.params.receiptId, trustId: req.trustId } })
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
  requirePermission(['receipt:create', 'receipt:reprint']),
  receiptSendLimiter,
  validateParams(receiptParams),
  validateBody(z.object({ channels: z.array(z.enum(['email'])).min(1) })),
  asyncHandler(async (req: TrustContextRequest, res) => {
    const member = req.trustMember!
    const receipt = await prismaPublic.receipt.findFirst({
      where: {
        id: req.params.receiptId,
        trustId: req.trustId,
        donation: donationVisibilityFilter(member),
      },
      select: { id: true, status: true, receiptNumber: true, verificationToken: true, donation: { select: { id: true, amount: true, email: true, submittedById: true } } },
    })
    if (!receipt) throw new AppError(404, 'Receipt not found')
    if (receipt.status !== 'ACTIVE') throw new AppError(400, 'Receipt is not active')
    if (!receipt.donation) throw new AppError(400, 'Donation not found for this receipt')

    const sent: string[] = []

    let donorEmail = receipt.donation.email ?? null
    if (!donorEmail && receipt.donation.submittedById) {
      const submitter = await prisma.trustMember.findUnique({
        where: { id: receipt.donation.submittedById },
        select: { user: { select: { email: true } } },
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
  validateParams(z.object({ receiptId: z.string().uuid() })),
  asyncHandler(async (req: AuthedRequest, res) => {
    const receipt = await prismaPublic.receipt.findUnique({ where: { id: req.params.receiptId } })
    if (!receipt || receipt.status !== 'ACTIVE') throw new AppError(404, 'Receipt not found')

    const member = await prisma.trustMember.findUnique({
      where: { trustId_userId: { trustId: receipt.trustId, userId: req.user!.id } },
    })

    let allowed = false
    if (member && member.status === 'ACTIVE') {
      // Membership alone must not decide access to the document: apply the same
      // permission-and-privacy policy as the list and detail reads.
      const effective: Prisma.DonationWhereInput | undefined = isOfficialMember(member)
        ? undefined
        : { OR: [{ privacy: 'PUBLIC' }, { submittedById: member.id }, { collectorId: member.id }] }
      const scoped = await prismaPublic.receipt.findFirst({
        where: { id: receipt.id, trustId: receipt.trustId, donation: effective },
        select: { id: true },
      })
      allowed = !!scoped
    }
    if (!allowed && req.user!.phone) {
      // A donor may always fetch the PDF for the donation they made.
      allowed = !!(await prisma.donation.findFirst({ where: { id: receipt.donationId, phone: req.user!.phone } }))
    }
    if (!allowed) throw new AppError(403, 'Not authorized to view this receipt')
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