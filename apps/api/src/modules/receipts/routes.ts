import { Router } from 'express'
import { z } from '@pavati/shared'
import { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import { AppError, asyncHandler, ok } from '../../lib/http.js'
import { requireAuth, type AuthedRequest } from '../../middleware/auth.js'
import { loadTrustContext, requirePermission, type TrustContextRequest } from '../../middleware/rbac.js'
import { validateBody, validateQuery } from '../../middleware/validate.js'
import { generateReceipt, verifyReceiptData } from '../../services/receipts.js'
import { audit } from '../../services/audit.js'
import { fileFromUrl } from '../../providers/storage.js'

const router = Router()

const listQuery = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  status: z.enum(['ACTIVE', 'VOID']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

router.use('/:trustId/receipts', requireAuth, loadTrustContext)

router.get(
  '/:trustId/receipts',
  requirePermission('receipt:view'),
  validateQuery(listQuery),
  asyncHandler(async (req: TrustContextRequest, res) => {
    const q = req.query as unknown as z.infer<typeof listQuery>
    const where: Prisma.ReceiptWhereInput = { trustId: req.trustId }
    if (q.status) where.status = q.status
    if (q.from || q.to) {
      where.generatedAt = {}
      if (q.from) where.generatedAt.gte = new Date(q.from)
      if (q.to) where.generatedAt.lte = new Date(q.to)
    }
    const page = q.page ?? 1
    const pageSize = q.pageSize ?? 20
    const [total, items] = await Promise.all([
      prisma.receipt.count({ where }),
      prisma.receipt.findMany({
        where,
        include: { donation: true, template: { select: { name: true } } },
        orderBy: { generatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ])
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
    const isDonor = await prisma.donation.findFirst({ where: { id: receipt.donationId, phone: req.user!.phone ?? undefined } })
    if (!isTrustMember && !isDonor) throw new AppError(403, 'Not authorized to view this receipt')
    if (!receipt.pdfUrl) throw new AppError(404, 'PDF not generated')
    const file = fileFromUrl(receipt.pdfUrl)
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