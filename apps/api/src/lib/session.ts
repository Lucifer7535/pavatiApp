import type { User } from '@prisma/client'
import { prisma } from './prisma.js'
import { publicUser, signAccessToken, signRefreshToken } from './jwt.js'

export async function buildAuthResponse(user: User) {
  const memberships = await prisma.trustMember.findMany({
    where: { userId: user.id, status: 'ACTIVE' },
    include: { trust: true },
    orderBy: { joinedAt: 'asc' },
  })
  return {
    accessToken: signAccessToken(user.id),
    refreshToken: signRefreshToken(user.id),
    user: publicUser(user),
    memberships: memberships.map((m) => ({
      id: m.id,
      trustId: m.trustId,
      role: m.role,
      status: m.status,
      joinedAt: m.joinedAt,
      trust: {
        id: m.trust.id,
        name: m.trust.name,
        uniqueCode: m.trust.uniqueCode,
        logoUrl: m.trust.logoUrl,
        festivalTypes: m.trust.festivalTypes,
        city: m.trust.city,
      },
    })),
  }
}

export async function createRefreshRecord(userId: string, refreshToken: string) {
  const crypto = await import('node:crypto')
  await prisma.refreshToken.create({
    data: {
      tokenHash: crypto.createHash('sha256').update(refreshToken).digest('hex'),
      userId,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  })
}