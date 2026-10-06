import { Router } from 'express'
import { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import { AppError, asyncHandler, ok } from '../../lib/http.js'
import { requireAuth } from '../../middleware/auth.js'
import { loadTrustContext, requirePermission, type TrustContextRequest } from '../../middleware/rbac.js'
import { audit } from '../../services/audit.js'
import { nextFYWindow, windowDateFilter } from '../../lib/financialYear.js'
import { openWindowForTrust } from '../../lib/financialWindow.js'

const router = Router()

router.use('/:trustId/financial-years', requireAuth, loadTrustContext)

function serializeWindow(window: { label: string; start: Date; end: Date }) {
  return { label: window.label, startDate: window.start, endDate: window.end }
}

router.get(
  '/:trustId/financial-years',
  requirePermission('donation:view'),
  asyncHandler(async (req: TrustContextRequest, res) => {
    const trustId = req.trustId!
    const trust = await prisma.trust.findUnique({ where: { id: trustId } })
    if (!trust) throw new AppError(404, 'Trust not found')

    const current = await openWindowForTrust(trust.id, trust)
    const alreadyClosed = await prisma.financialYearClose.findUnique({
      where: { trustId_year: { trustId, year: current.label } },
    })

    const [closed] = await Promise.all([
      prisma.financialYearClose.findMany({ where: { trustId }, orderBy: { startDate: 'asc' } }),
    ])

    ok(res, {
      current: serializeWindow(current),
      closed: closed.map((c) => ({
        id: c.id,
        year: c.year,
        startDate: c.startDate,
        endDate: c.endDate,
        totalAmount: c.totalAmount,
        donationCount: c.donationCount,
        donorCount: c.donorCount,
        byMode: c.byMode,
        byCategory: c.byCategory,
        closedAt: c.closedAt,
      })),
      canClose: (req.effectivePermissions ?? []).includes('financialYear:close') && !alreadyClosed,
    })
  })
)

router.post(
  '/:trustId/financial-years/close',
  requirePermission('financialYear:close'),
  asyncHandler(async (req: TrustContextRequest, res) => {
    const trustId = req.trustId!
    const trust = await prisma.trust.findUnique({ where: { id: trustId } })
    if (!trust) throw new AppError(404, 'Trust not found')

    const window = await openWindowForTrust(trust.id, trust)
    const existing = await prisma.financialYearClose.findUnique({
      where: { trustId_year: { trustId, year: window.label } },
    })
    if (existing) throw new AppError(409, `Financial year ${window.label} is already closed`)

    const scoped: Prisma.DonationWhereInput = { trustId, status: 'SUCCEEDED', donationDate: windowDateFilter(window) }

    const [sumAgg, donorGroups, byMode, byCategory] = await Promise.all([
      prisma.donation.aggregate({ where: scoped, _sum: { amount: true }, _count: true }),
      prisma.donation.groupBy({ by: ['donorName', 'phone'], where: scoped }),
      prisma.donationSplit.groupBy({
        by: ['paymentMode'],
        where: { donation: scoped },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.donation.groupBy({ by: ['category'], where: scoped, _sum: { amount: true }, _count: true }),
    ])

    const totalAmount = sumAgg._sum.amount ?? 0
    const donationCount = sumAgg._count
    const donorCount = donorGroups.length

    const closed = await prisma.$transaction(async (tx) => {
      const record = await tx.financialYearClose.create({
        data: {
          trustId,
          year: window.label,
          startDate: window.start,
          endDate: window.end,
          totalAmount,
          donationCount,
          donorCount,
          byMode: byMode.map((m) => ({ mode: m.paymentMode, amount: m._sum.amount ?? 0, count: m._count })),
          byCategory: byCategory.map((c) => ({ category: c.category, amount: c._sum.amount ?? 0, count: c._count })),
          closedById: req.user!.id,
        },
      })
      await tx.trust.update({ where: { id: trustId }, data: { financialYear: nextFYWindow(trust, window).label } })
      return record
    })

    await audit({
      actorId: req.user!.id,
      trustId,
      action: 'FINANCIAL_YEAR_CLOSED',
      entityType: 'Trust',
      entityId: trustId,
      metadata: { year: closed.year, totalAmount, donationCount, donorCount },
    })

    const next = nextFYWindow(trust, window)
    ok(res, {
      closed: {
        id: closed.id,
        year: closed.year,
        startDate: closed.startDate,
        endDate: closed.endDate,
        totalAmount: closed.totalAmount,
        donationCount: closed.donationCount,
        donorCount: closed.donorCount,
        byMode: closed.byMode,
        byCategory: closed.byCategory,
        closedAt: closed.closedAt,
      },
      current: serializeWindow(next),
    }, 201)
  })
)

export default router