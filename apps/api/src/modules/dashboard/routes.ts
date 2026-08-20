import { Router } from 'express'
import { prisma } from '../../lib/prisma.js'
import { asyncHandler, ok } from '../../lib/http.js'
import { requireAuth } from '../../middleware/auth.js'
import { loadTrustContext, type TrustContextRequest } from '../../middleware/rbac.js'

const router = Router()

router.use('/:trustId/dashboard', requireAuth, loadTrustContext)

router.get(
  '/:trustId/dashboard',
  asyncHandler(async (req: TrustContextRequest, res) => {
    const trustId = req.trustId!
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const [totalAgg, donorCount, cashAgg, upiAgg, onlineAgg, todayAgg, pendingCount, memberCount, recentTransactions, recentMembers, campaigns] = await Promise.all([
      prisma.donation.aggregate({ where: { trustId, status: 'SUCCEEDED' }, _sum: { amount: true } }),
      prisma.donation.groupBy({ by: ['donorName', 'phone'], where: { trustId, status: 'SUCCEEDED' } }),
      prisma.donation.aggregate({ where: { trustId, status: 'SUCCEEDED', paymentMode: 'CASH' }, _sum: { amount: true } }),
      prisma.donation.aggregate({ where: { trustId, status: 'SUCCEEDED', paymentMode: 'UPI' }, _sum: { amount: true } }),
      prisma.donation.aggregate({ where: { trustId, status: 'SUCCEEDED', paymentMode: 'ONLINE' }, _sum: { amount: true } }),
      prisma.donation.aggregate({ where: { trustId, status: 'SUCCEEDED', donationDate: { gte: todayStart } }, _sum: { amount: true } }),
      prisma.donation.count({ where: { trustId, status: 'PENDING' } }),
      prisma.trustMember.count({ where: { trustId, status: 'ACTIVE' } }),
      prisma.donation.findMany({
        where: { trustId },
        include: { receipts: { orderBy: { generatedAt: 'desc' }, take: 1 } },
        orderBy: { donationDate: 'desc' },
        take: 8,
      }),
      prisma.trustMember.findMany({ where: { trustId, status: 'ACTIVE' }, include: { user: true }, orderBy: { joinedAt: 'desc' }, take: 5 }),
      prisma.paymentCampaign.findMany({ where: { trustId }, orderBy: { createdAt: 'desc' }, take: 5 }),
    ])

    ok(res, {
      totalCollected: totalAgg._sum.amount ?? 0,
      totalDonors: donorCount.length,
      cashCollected: cashAgg._sum.amount ?? 0,
      upiCollected: upiAgg._sum.amount ?? 0,
      onlineCollected: onlineAgg._sum.amount ?? 0,
      todayCollected: todayAgg._sum.amount ?? 0,
      pendingCount,
      memberCount,
      recentTransactions,
      recentMembers: recentMembers.map((m) => ({ id: m.id, name: m.user.name, role: m.role, profileImage: m.user.profileImage, joinedAt: m.joinedAt })),
      campaigns,
    })
  })
)

export default router