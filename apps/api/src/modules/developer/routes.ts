import { Router } from 'express'
import jwt from 'jsonwebtoken'
import { prisma } from '../../lib/prisma.js'
import { config } from '../../config/index.js'
import { AppError, asyncHandler, ok } from '../../lib/http.js'
import { requireDevAuth } from '../../middleware/dev-auth.js'

const router = Router()

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password } = req.body ?? {}
    if (!email || !password) throw new AppError(422, 'Email and password are required')

    if (email !== config.devEmail || password !== config.devPassword) {
      throw new AppError(401, 'Invalid developer credentials')
    }

    const token = jwt.sign({ sub: 'developer', type: 'developer' } satisfies { sub: string; type: 'developer' }, config.jwtSecret, {
      expiresIn: '24h',
    })

    ok(res, { token })
  })
)

router.get(
  '/stats',
  requireDevAuth,
  asyncHandler(async (req, res) => {
    const fromStr = req.query.from as string | undefined
    const toStr = req.query.to as string | undefined
    const from = fromStr ? new Date(fromStr) : undefined
    const to = toStr ? new Date(toStr) : undefined
    if ((fromStr && isNaN(from!.getTime())) || (toStr && isNaN(to!.getTime()))) {
      throw new AppError(422, 'Invalid date range')
    }

    const dayWhere =
      from || to
        ? {
            createdAt: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : undefined

    const donationDateWhere =
    from || to
      ? {
          donationDate: {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
          },
        }
      : undefined

    const userDayFilter = (() => {
      if (!from && !to) return ''
      const parts: string[] = []
      if (from) parts.push(`"createdAt" >= ${toSql(from)}`)
      if (to) parts.push(`"createdAt" <= ${toSql(to)}`)
      return `WHERE ${parts.join(' AND ')}`
    })()

    const trustDayFilter = (() => {
      if (!from && !to) return ''
      const parts: string[] = []
      if (from) parts.push(`"createdAt" >= ${toSql(from)}`)
      if (to) parts.push(`"createdAt" <= ${toSql(to)}`)
      return `WHERE ${parts.join(' AND ')}`
    })()

    const [
      totalUsers,
      totalTrusts,
      totalMembers,
      totalDonations,
      totalReceipts,
      totalCampaigns,
      totalAnnouncements,
      totalJoinRequests,
      pendingJoinRequests,
      donationStats,
      usersByDay,
      trustsByDay,
      trustBreakdown,
      recentUsers,
    ] = await Promise.all([
      prisma.user.count({ where: dayWhere }),
      prisma.trust.count({ where: dayWhere }),
      prisma.trustMember.count(),
      prisma.donation.count({ where: donationDateWhere }),
      prisma.receipt.count({ where: donationDateWhere ? { donation: { donationDate: donationDateWhere.donationDate } } : undefined }),
      prisma.paymentCampaign.count({ where: dayWhere }),
      prisma.announcement.count({ where: dayWhere ? { publishedAt: dayWhere.createdAt } : undefined }),
      prisma.joinRequest.count({ where: dayWhere }),
      prisma.joinRequest.count({ where: { status: 'PENDING', ...(dayWhere ?? {}) } }),
      prisma.donation.groupBy({
        by: ['status'],
        _count: { id: true },
        _sum: { amount: true },
        where: donationDateWhere,
      }),
      prisma.$queryRawUnsafe<{ date: string; count: bigint }[]>(
        `SELECT DATE_TRUNC('day', "createdAt")::text AS date, COUNT(*)::int AS count
         FROM "User"
         ${userDayFilter}
         GROUP BY 1 ORDER BY 1`
      ),
      prisma.$queryRawUnsafe<{ date: string; count: bigint }[]>(
        `SELECT DATE_TRUNC('day', "createdAt")::text AS date, COUNT(*)::int AS count
         FROM "Trust"
         ${trustDayFilter}
         GROUP BY 1 ORDER BY 1`
      ),
      prisma.$queryRaw<{
        id: string
        name: string
        member_count: bigint
        donation_count: bigint
        total_amount: bigint
      }[]>`
        SELECT
          t."id",
          t."name",
          (SELECT COUNT(*)::int FROM "TrustMember" tm WHERE tm."trustId" = t."id") AS member_count,
          (SELECT COUNT(*)::int FROM "Donation" d WHERE d."trustId" = t."id") AS donation_count,
          (SELECT COALESCE(SUM(d."amount"), 0)::int FROM "Donation" d WHERE d."trustId" = t."id" AND d."status" = 'SUCCEEDED') AS total_amount
        FROM "Trust" t
        ORDER BY total_amount DESC
      `,
      prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, name: true, email: true, phone: true, createdAt: true },
      }),
    ])

    const donationByStatus = donationStats.map((d) => ({
      status: d.status,
      count: d._count.id,
      totalAmount: d._sum.amount ?? 0,
    }))

    const totalDonationAmount = donationByStatus.find((d) => d.status === 'SUCCEEDED')?.totalAmount ?? 0

    const trustBreakdownFormatted = trustBreakdown.map((t) => ({
      id: t.id,
      name: t.name,
      memberCount: Number(t.member_count),
      donationCount: Number(t.donation_count),
      totalAmount: Number(t.total_amount),
    }))

    ok(res, {
      summary: {
        totalUsers,
        totalTrusts,
        totalMembers,
        totalDonations,
        totalDonationAmount,
        totalReceipts,
        totalCampaigns,
        totalAnnouncements,
        totalJoinRequests,
        pendingJoinRequests,
      },
      donationByStatus,
      usersByDay: usersByDay.map((d) => ({ date: d.date, count: Number(d.count) })),
      trustsByDay: trustsByDay.map((d) => ({ date: d.date, count: Number(d.count) })),
      trustBreakdown: trustBreakdownFormatted,
      recentUsers,
    })
  })
)

function toSql(date: Date): string {
  return `'${date.toISOString()}'::timestamptz`
}

export default router