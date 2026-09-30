import type { User } from '@prisma/client'
import { prisma } from './prisma.js'
import { publicUser } from './jwt.js'

/**
 * A minimal projection used when `contactVisible` is false (the schema default).
 * Mirrors trusts/routes.ts, which already degrades the same way.
 */
function hiddenContact(u: User) {
  return { id: u.id, name: u.name, profileImage: u.profileImage }
}

/**
 * Resolves the `contactVisible` consent boundary for a batch of users in one trust.
 *
 * The credential strip in lib/prisma.ts cannot enforce this: the consent decision lives
 * on TrustMember while the included relation runs Announcement.author -> User, so it is
 * one hop out of reach of a query-result projection.
 *
 * Callers must still narrow the `include`/`select` on the relation so the raw email and
 * phone are actually fetched — this map only decides what is released.
 */
export async function visibleUserMap(trustId: string, userIds: string[]) {
  const ids = [...new Set(userIds)].filter((id): id is string => typeof id === 'string' && id.length > 0)
  if (ids.length === 0) return new Map<string, ReturnType<typeof publicUser>>()

  const rows = await prisma.trustMember.findMany({
    where: { trustId, userId: { in: ids } },
    select: { userId: true, contactVisible: true, user: true },
  })

  return new Map(
    rows.map((m) => [m.userId, m.contactVisible ? publicUser(m.user) : hiddenContact(m.user)] as const),
  )
}
