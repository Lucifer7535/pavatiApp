import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient; prismaPublic?: PrismaClient }

const CREDENTIAL_FIELDS = ['passwordHash', 'tokenHash'] as const

/**
 * Recursively removes credential columns from a query result.
 *
 * This walks nested relations on purpose. The historical leaks were all NESTED
 * (announcement.author, receipt.donation.submitter.user, donation.collector.user,
 * donation.splits[].verifiedBy.user, trustMember.user), so a guard keyed on the model the
 * operation was invoked on never fires for those rows.
 */
const stripCredentials = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stripCredentials)
  if (value === null || typeof value !== 'object') return value
  const row = value as Record<string, unknown>
  for (const field of CREDENTIAL_FIELDS) delete row[field]
  for (const child of Object.values(row)) stripCredentials(child)
  return row
}

/**
 * Internal client. MUST be used anywhere a credential column is legitimately read —
 * auth/routes.ts compares against user.passwordHash and users/routes.ts rotates it.
 * Never serialise a result of this client into an HTTP response.
 */
export const prisma = globalForPrisma.prisma ?? new PrismaClient()

/**
 * Response-facing client for every route module, so no handler can serialise a
 * credential column by forgetting a nested select.
 */
export const prismaPublic = (globalForPrisma.prismaPublic ?? new PrismaClient()).$extends({
  query: {
    $allModels: {
      async $allOperations({ args, query }: { args: unknown; query: (a: unknown) => Promise<unknown> }) {
        return stripCredentials(await query(args))
      },
    },
  },
})

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
  globalForPrisma.prismaPublic = prismaPublic as unknown as PrismaClient
}
