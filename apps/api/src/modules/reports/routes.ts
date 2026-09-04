import { Router } from 'express'
import { z } from '@pavati/shared'
import { Prisma, type PaymentMode } from '@prisma/client'
import ExcelJS from 'exceljs'
import { prisma } from '../../lib/prisma.js'
import { asyncHandler, ok } from '../../lib/http.js'
import { requireAuth } from '../../middleware/auth.js'
import { loadTrustContext, requirePermission, type TrustContextRequest } from '../../middleware/rbac.js'
import { todayStartIn } from '../../config/index.js'
import { validateQuery } from '../../middleware/validate.js'

const router = Router()

const querySchema = z.object({ from: z.string().optional(), to: z.string().optional() })

const detailedQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  paymentMode: z.enum(['CASH', 'UPI', 'MIXED']).optional(),
  receiptStatus: z.enum(['ACTIVE', 'VOID']).optional(),
  addressContains: z.string().optional(),
  addressEquals: z.string().optional(),
  amountMin: z.coerce.number().optional(),
  amountMax: z.coerce.number().optional(),
  amountEquals: z.coerce.number().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
})

router.use(['/:trustId/reports', '/:trustId/audit-log'], requireAuth, loadTrustContext)

router.get(
  '/:trustId/reports/summary',
  requirePermission('report:view'),
  asyncHandler(async (req: TrustContextRequest, res) => {
    const trustId = req.trustId!
    const q = req.query as { from?: string; to?: string }
    const from = q.from ? new Date(q.from) : undefined
    const to = q.to ? new Date(q.to) : undefined
    const dateFilter: Prisma.DonationWhereInput['donationDate'] = from || to ? { ...(from && { gte: from }), ...(to && { lte: to }) } : undefined

    const todayStart = todayStartIn()

    const [totalDonations, sumAgg, today, todayAgg, cashAgg, upiAgg, modeCounts, categoryCounts] = await Promise.all([
      prisma.donation.count({ where: { trustId, status: 'SUCCEEDED', ...(dateFilter ? { donationDate: dateFilter } : {}) } }),
      prisma.donation.aggregate({ where: { trustId, status: 'SUCCEEDED', ...(dateFilter ? { donationDate: dateFilter } : {}) }, _sum: { amount: true } }),
      prisma.donation.count({ where: { trustId, status: 'SUCCEEDED', donationDate: { gte: todayStart } } }),
      prisma.donation.aggregate({ where: { trustId, status: 'SUCCEEDED', donationDate: { gte: todayStart } }, _sum: { amount: true } }),
      prisma.donationSplit.aggregate({ where: { donation: { trustId, status: 'SUCCEEDED', ...(dateFilter ? { donationDate: dateFilter } : {}) }, paymentMode: 'CASH' }, _sum: { amount: true } }),
      prisma.donationSplit.aggregate({ where: { donation: { trustId, status: 'SUCCEEDED', ...(dateFilter ? { donationDate: dateFilter } : {}) }, paymentMode: 'UPI' }, _sum: { amount: true } }),
      prisma.donationSplit.groupBy({ by: ['paymentMode'], where: { donation: { trustId, status: 'SUCCEEDED', ...(dateFilter ? { donationDate: dateFilter } : {}) } }, _sum: { amount: true }, _count: true }),
      prisma.donation.groupBy({ by: ['category'], where: { trustId, status: 'SUCCEEDED', ...(dateFilter ? { donationDate: dateFilter } : {}) }, _sum: { amount: true }, _count: true }),
    ])
    const memberCount = await prisma.trustMember.count({ where: { trustId, status: 'ACTIVE' } })
    ok(res, {
      totalDonations,
      totalCollected: sumAgg._sum.amount ?? 0,
      todayDonations: today,
      todayCollected: todayAgg._sum.amount ?? 0,
      cashCollected: cashAgg._sum.amount ?? 0,
      upiCollected: upiAgg._sum.amount ?? 0,
      memberCount,
      byMode: modeCounts
        .filter((m) => m.paymentMode === 'CASH' || m.paymentMode === 'UPI')
        .map((m) => ({ mode: m.paymentMode, amount: m._sum.amount ?? 0, count: m._count })),
      byCategory: categoryCounts.map((c) => ({ category: c.category, amount: c._sum.amount ?? 0, count: c._count })),
    })
  })
)

router.get(
  '/:trustId/reports/daily',
  requirePermission('report:view'),
  validateQuery(querySchema),
  asyncHandler(async (req: TrustContextRequest, res) => {
    const q = req.query as { from?: string; to?: string }
    const from = q.from ?? new Date(Date.now() - 30 * 86400000).toISOString()
    const to = q.to ?? new Date().toISOString()
    const donations = await prisma.donation.findMany({
      where: { trustId: req.trustId, status: 'SUCCEEDED', donationDate: { gte: new Date(from), lte: new Date(to) } },
      select: { donationDate: true, amount: true },
    })
    const byDay = new Map<string, { date: string; amount: number; count: number }>()
    for (const d of donations) {
      const key = d.donationDate.toISOString().slice(0, 10)
      const cur = byDay.get(key) ?? { date: key, amount: 0, count: 0 }
      cur.amount += d.amount
      cur.count += 1
      byDay.set(key, cur)
    }
    ok(res, Array.from(byDay.values()).sort((a, b) => a.date.localeCompare(b.date)))
  })
)

router.get(
  '/:trustId/reports/collectors',
  requirePermission('report:view'),
  asyncHandler(async (req: TrustContextRequest, res) => {
    const collectors = await prisma.donation.groupBy({
      by: ['collectorId'],
      where: { trustId: req.trustId, status: 'SUCCEEDED', collectorId: { not: null } },
      _sum: { amount: true },
      _count: true,
    })
    const ids = collectors.map((c) => c.collectorId!).filter(Boolean)
    const members = await prisma.trustMember.findMany({ where: { id: { in: ids } }, include: { user: true } })
    ok(res, collectors.map((c) => {
      const m = members.find((mm) => mm.id === c.collectorId)
      return { collectorId: c.collectorId, collectorName: m?.user.name ?? 'Unknown', amount: c._sum.amount ?? 0, count: c._count, role: m?.role }
    }))
  })
)

router.get(
  '/:trustId/reports/export',
  requirePermission('report:view'),
  validateQuery(detailedQuerySchema),
  asyncHandler(async (req: TrustContextRequest, res) => {
    const q = req.query as unknown as z.infer<typeof detailedQuerySchema>
    const where = buildDetailedWhere(q, req.trustId!)
    const totalCount = await prisma.donation.count({ where })
    const donations = await prisma.donation.findMany({
      where,
      include: { collector: { include: { user: true } }, campaign: true, receipts: { orderBy: { generatedAt: 'desc' }, take: 1 } },
      orderBy: { donationDate: 'desc' },
      take: 10000,
    })
    const truncated = totalCount > 10000
    const rows = [['Receipt No', 'Date', 'Donor', 'Phone', 'Email', 'Address', 'Amount', 'Mode', 'Category', 'Collector', 'Status', 'Privacy']]
    for (const d of donations) {
      rows.push([
        d.receipts[0]?.receiptNumber ?? '',
        d.donationDate.toISOString().slice(0, 10),
        d.donorName,
        d.phone ?? '',
        d.email ?? '',
        d.address ?? '',
        String(d.amount),
        d.paymentMode,
        d.category,
        d.collector?.user.name ?? '',
        d.status,
        d.privacy,
      ])
    }
    if (truncated) {
      rows.push(['', '', '', '', '', `Export truncated at 10,000 records (${totalCount} total). Refine your filters to export all records.`])
    }
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', 'attachment; filename="donations-export.csv"')
    res.send('\uFEFF' + csv)
  })
)

function buildDetailedWhere(q: z.infer<typeof detailedQuerySchema>, trustId: string): Prisma.DonationWhereInput {
  const where: Prisma.DonationWhereInput = { trustId, status: 'SUCCEEDED' }
  if (q.from || q.to) {
    where.donationDate = {}
    if (q.from) where.donationDate.gte = new Date(q.from)
    if (q.to) where.donationDate.lte = new Date(q.to)
  }
  if (q.paymentMode) where.paymentMode = q.paymentMode as PaymentMode
  if (q.addressContains) where.address = { contains: q.addressContains, mode: 'insensitive' }
  if (q.addressEquals) where.address = { equals: q.addressEquals, mode: 'insensitive' }
  if (q.amountEquals !== undefined) where.amount = q.amountEquals
  else if (q.amountMin !== undefined || q.amountMax !== undefined) {
    where.amount = {}
    if (q.amountMin !== undefined) where.amount.gte = q.amountMin
    if (q.amountMax !== undefined) where.amount.lte = q.amountMax
  }
  if (q.receiptStatus) {
    where.receipts = { some: { status: q.receiptStatus } }
  }
  return where
}

router.get(
  '/:trustId/reports/detailed',
  requirePermission('report:view'),
  validateQuery(detailedQuerySchema),
  asyncHandler(async (req: TrustContextRequest, res) => {
    const q = req.query as unknown as z.infer<typeof detailedQuerySchema>
    const where = buildDetailedWhere(q, req.trustId!)
    const page = q.page ?? 1
    const pageSize = q.pageSize ?? 50

    const [total, totalAgg, items] = await Promise.all([
      prisma.donation.count({ where }),
      prisma.donation.aggregate({ where, _sum: { amount: true } }),
      prisma.donation.findMany({
        where,
        include: { receipts: { orderBy: { generatedAt: 'desc' }, take: 1 }, collector: { include: { user: true } } },
        orderBy: { donationDate: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ])

    ok(res, {
      total,
      totalAmount: totalAgg._sum.amount ?? 0,
      page,
      pageSize,
      items: items.map((d) => ({
        id: d.id,
        receiptNumber: d.receipts[0]?.receiptNumber ?? '',
        donationDate: d.donationDate,
        donorName: d.donorName,
        phone: d.phone ?? '',
        email: d.email ?? '',
        address: d.address ?? '',
        amount: d.amount,
        paymentMode: d.paymentMode,
        category: d.category,
        collectorName: d.collector?.user.name ?? '',
        status: d.status,
        privacy: d.privacy,
      })),
    })
  })
)

router.get(
  '/:trustId/reports/export-excel',
  requirePermission('report:view'),
  validateQuery(detailedQuerySchema),
  asyncHandler(async (req: TrustContextRequest, res) => {
    const q = req.query as unknown as z.infer<typeof detailedQuerySchema>
    const where = buildDetailedWhere(q, req.trustId!)
    const totalCount = await prisma.donation.count({ where })

    const donations = await prisma.donation.findMany({
      where,
      include: { receipts: { orderBy: { generatedAt: 'desc' }, take: 1 }, collector: { include: { user: true } } },
      orderBy: { donationDate: 'desc' },
      take: 10000,
    })

    const truncated = totalCount > 10000

    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'Pāvati'
    workbook.created = new Date()
    const sheet = workbook.addWorksheet('Donations')

    sheet.columns = [
      { header: 'Receipt No', key: 'receiptNumber', width: 18 },
      { header: 'Date', key: 'date', width: 14 },
      { header: 'Donor Name', key: 'donorName', width: 22 },
      { header: 'Phone', key: 'phone', width: 14 },
      { header: 'Email', key: 'email', width: 24 },
      { header: 'Address', key: 'address', width: 30 },
      { header: 'Amount', key: 'amount', width: 12 },
      { header: 'Payment Mode', key: 'paymentMode', width: 14 },
      { header: 'Category', key: 'category', width: 18 },
      { header: 'Collector', key: 'collector', width: 20 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Privacy', key: 'privacy', width: 12 },
    ]

    const headerRow = sheet.getRow(1)
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF9F1239' } }
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' }

    for (const d of donations) {
      sheet.addRow({
        receiptNumber: d.receipts[0]?.receiptNumber ?? '',
        date: d.donationDate.toISOString().slice(0, 10),
        donorName: d.donorName,
        phone: d.phone ?? '',
        email: d.email ?? '',
        address: d.address ?? '',
        amount: d.amount,
        paymentMode: d.paymentMode,
        category: d.category,
        collector: d.collector?.user.name ?? '',
        status: d.status,
        privacy: d.privacy,
      })
    }

    if (truncated) {
      sheet.addRow({ address: `Export truncated at 10,000 records (${totalCount} total). Refine your filters to export all records.` })
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', 'attachment; filename="donations-report.xlsx"')
    await workbook.xlsx.write(res)
    res.end()
  })
)

router.get(
  '/:trustId/audit-log',
  requirePermission('audit:view'),
  asyncHandler(async (req: TrustContextRequest, res) => {
    const page = Math.max(1, Number(req.query.page) || 1)
    const pageSize = Math.min(200, Math.max(1, Number(req.query.pageSize) || 50))
    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where: { trustId: req.trustId } }),
      prisma.auditLog.findMany({
        where: { trustId: req.trustId },
        include: { actor: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ])
    ok(res, { total, page, pageSize, items: logs })
  })
)

export default router