import type { TrustMember } from '@prisma/client'
import type { Prisma } from '@prisma/client'
import { OFFICIAL_ROLES, type TrustRole } from '@pavati/shared'
import { effectivePermissionsFor } from '../middleware/rbac.js'

/**
 * The single donation-visibility policy shared by the receipt list, receipt detail,
 * receipt PDF and donation detail reads, so those four cannot drift apart again.
 *
 * Two independent narrowing steps:
 *
 *  1. `ownOnly` — a principal narrowed to `donation:view_own` may only act on donations
 *     it submitted or collects. NOTE: `receipt:view` is in the `everyone` default
 *     permission set, so today every role satisfies this branch and `ownOnly` resolves
 *     false. It is kept explicit (rather than deleted) so that narrowing the default set
 *     later cannot silently re-open the gap.
 *
 *  2. The non-official privacy OR — a role outside OFFICIAL_ROLES additionally may not see
 *     a donation someone else marked PRIVATE or ANONYMOUS.
 */
export function donationVisibilityFilter(member: TrustMember): Prisma.DonationWhereInput {
  const perms = effectivePermissionsFor(member)
  const ownOnly = !perms.includes('receipt:view') && !perms.includes('donation:view')
  const isOfficial = OFFICIAL_ROLES.includes(member.role as TrustRole)
  return {
    ...(ownOnly ? { submittedById: member.id } : {}),
    ...(isOfficial ? {} : { OR: [{ privacy: 'PUBLIC' }, { submittedById: member.id }, { collectorId: member.id }] }),
  }
}

/** True when the member's role sits in the trust's official/officer set. */
export function isOfficialMember(member: TrustMember): boolean {
  return OFFICIAL_ROLES.includes(member.role as TrustRole)
}
