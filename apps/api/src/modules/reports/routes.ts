import { Router } from 'express'
import { z } from '@pavati/shared'
import { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import { asyncHandler, ok } from '../../lib/http.js'
import { requireAuth } from '../../middleware/auth.js'
import { loadTrustContext, requirePermission, type TrustContextRequest } from '../../middleware/rbac.js'
import { validateQuery } from '../../middleware/validate.js'

const router = Router()

const querySchema = z.object({ from: z.string().optional(), to: z.string().optional() })

router.use('/:trustId/reports', requireAuth, loadTrustContext)

router.get(
  '/:trustId/reports/summary',
  requirePermission('report:view'),
  asyncHandler(async (req: TrustContextRequest, res) => {
    const trustId = req.trustId!
    const q = req.query as { from?: string; to?: string }
    const from = q.from ? new Date(q.from) : undefined
    const to = q.to ? new Date(q.to) : undefined
    const dateFilter: Prisma.DonationWhereInput['donationDate'] = from || to ? { ...(from && { gte: from }), ...(to && { lte: to }) } : undefined
    const [totalDonations, sumAgg, today, todayAgg, cashAgg, upiAgg, onlineAgg, modeCounts, categoryCounts] = await Promise.all([
      prisma.donation.count({ where: { trustId, status: 'SUCCEEDED', ...(dateFilter ? { donationDate: dateFilter } : {}) } }),
      prisma.donation.aggregate({ where: { trustId, status: 'SUCCEEDED', ...(dateFilter ? { donationDate: dateFilter } : {}) }, _sum: { amount: true } }),
      prisma.donation.count({ where: { trustId, status: 'SUCCEEDED', donationDate: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } } }),
      prisma.donation.aggregate({ where: { trustId, status: 'SUCCEEDED', donationDate: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } }, _sum: { amount: true } }),
      prisma.donation.aggregate({ where: { trustId, status: 'SUCCEEDED', paymentMode: 'CASH', ...(dateFilter ? { donationDate: dateFilter } : {}) }, _sum: { amount: true } }),
      prisma.donation.aggregate({ where: { trustId, status: 'SUCCEEDED', paymentMode: 'UPI', ...(dateFilter ? { donationDate: dateFilter } : {}) }, _sum: { amount: true } }),
      prisma.donation.aggregate({ where: { trustId, status: 'SUCCEEDED', paymentMode: 'ONLINE', ...(dateFilter ? { donationDate: dateFilter } : {}) }, _sum: { amount: true } }),
      prisma.donation.groupBy({ by: ['paymentMode'], where: { trustId, status: 'SUCCEEDED', ...(dateFilter ? { donationDate: dateFilter } : {}) }, _sum: { amount: true }, _count: true }),
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
      onlineCollected: onlineAgg._sum.amount ?? 0,
      memberCount,
      byMode: modeCounts.map((m) => ({ mode: m.paymentMode, amount: m._sum.amount ?? 0, count: m._count })),
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
  asyncHandler(async (req: TrustContextRequest, res) => {
    const donations = await prisma.donation.findMany({
      where: { trustId: req.trustId },
      include: { collector: { include: { user: true } }, campaign: true },
      orderBy: { donationDate: 'desc' },
      take: 10000,
    })
    const rows = [['Receipt No', 'Date', 'Donor', 'Phone', 'Amount', 'Mode', 'Category', 'Collector', 'Status', 'Privacy']]
    for (const d of donations) {
      const receipt = await prisma.receipt.findFirst({ where: { donationId: d.id }, orderBy: { generatedAt: 'desc' } })
      rows.push([
        receipt?.receiptNumber ?? '',
        d.donationDate.toISOString().slice(0, 10),
        d.donorName,
        d.phone ?? '',
        String(d.amount),
        d.paymentMode,
        d.category,
        d.collector?.user.name ?? '',
        d.status,
        d.privacy,
      ])
    }
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', 'attachment; filename="donations-export.csv"')
    res.send('\uFEFF' + csv)
  })
)

router.get(
  '/:trustId/audit-log',
  requirePermission('audit:view'),
  asyncHandler(async (req: TrustContextRequest, res) => {
    const logs = await prisma.auditLog.findMany({
      where: { trustId: req.trustId },
      include: { actor: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    })
    ok(res, logs)
  })
)

export default router