import { Prisma, PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

/**
 * Tables truncated by the reset, ordered child-first so foreign keys never block the
 * wipe. Kept as one list so the guard below can report exactly what is at stake.
 */
const TRUNCATED_TABLES = [
  'auditLog',
  'notification',
  'announcement',
  'paymentTransaction',
  'joinRequest',
  'trustInvite',
  'receipt',
  'receiptNumberConfig',
  'paymentCampaign',
  'donation',
  'donor',
  'receiptTemplate',
  'trustMember',
  'trust',
  'refreshToken',
  'user',
] as const

/**
 * This seed is a full reset: it deletes every row in all 16 application tables.
 *
 * Previously it ran those deletes as independent autocommitted statements with no
 * environment check, so a single mistyped command against a production DATABASE_URL
 * destroyed live donation and receipt records irrecoverably — and, because each
 * delete committed on its own, a failure halfway through left the database partially
 * wiped with no way back.
 *
 * Two independent guards now have to be passed deliberately:
 *   1. SEED_ALLOW_DESTRUCTIVE=true — an explicit acknowledgement of the wipe.
 *   2. A non-production NODE_ENV, or SEED_FORCE_PRODUCTION=true for an operator who
 *      genuinely means to reset a live database.
 */
function assertDestructiveResetAllowed() {
  const acknowledged = process.env.SEED_ALLOW_DESTRUCTIVE === 'true'
  const forced = process.env.SEED_FORCE_PRODUCTION === 'true'
  const isProduction = process.env.NODE_ENV === 'production'

  if (!acknowledged) {
    throw new Error(
      'Refusing to run: this seed deletes all rows in ' +
        `${TRUNCATED_TABLES.length} tables (${TRUNCATED_TABLES.join(', ')}).\n` +
        'Set SEED_ALLOW_DESTRUCTIVE=true to confirm you intend to wipe the database.',
    )
  }

  if (isProduction && !forced) {
    throw new Error(
      'Refusing to run: NODE_ENV=production and this seed would destroy live data.\n' +
        'Run against a development database, or set SEED_FORCE_PRODUCTION=true if a live reset is genuinely intended.',
    )
  }

  // Name the target so the operator can confirm which database they just destroyed.
  let host = '(unknown)'
  try {
    host = new URL(process.env.DATABASE_URL ?? '').host
  } catch {
    host = '(unparseable DATABASE_URL)'
  }
  console.warn(`WARNING: wiping all rows from ${TRUNCATED_TABLES.length} tables on ${host}`)
}

/**
 * The bootstrap admin password is supplied by the operator.
 *
 * It used to be a literal committed to the repository, which meant anyone with read
 * access to the source — including every fork and CI cache — held a working credential
 * for the ordinary email/password login endpoint on any deployment that ran this seed.
 * The literal is deliberately not reproduced here, not even as a denylist entry:
 * committing it again would preserve exactly the leak being fixed. Rotating the
 * password on any database that was already seeded is an operational step, not
 * something this file can enforce.
 *
 * There is no default; the seed refuses to run without one.
 */
function resolveAdminPassword(): string {
  const password = process.env.SEED_ADMIN_PASSWORD
  if (!password) {
    throw new Error(
      'Refusing to run: SEED_ADMIN_PASSWORD is required.\n' +
        'Generate one, for example:  node -e "console.log(require(\'crypto\').randomBytes(24).toString(\'base64url\'))"',
    )
  }
  if (password.length < 12) {
    throw new Error('Refusing to run: SEED_ADMIN_PASSWORD must be at least 12 characters')
  }
  if (password.startsWith('pavati-dev-')) {
    throw new Error('Refusing to run: SEED_ADMIN_PASSWORD must not be a known published value')
  }
  return password
}

async function main() {
  assertDestructiveResetAllowed()

  const adminPassword = resolveAdminPassword()
  const adminEmail = process.env.SEED_ADMIN_EMAIL
  if (!adminEmail) throw new Error('Refusing to run: SEED_ADMIN_EMAIL is required')
  const adminName = process.env.SEED_ADMIN_NAME ?? 'Administrator'

  console.log('Seeding bootstrap admin user…')

  // One transaction: either every table is emptied or none is. Previously each delete
  // autocommitted, so an error partway through left a half-destroyed database.
  const deletes = TRUNCATED_TABLES.map((table) => {
    const delegate = prisma[table] as unknown as {
      deleteMany: () => Prisma.PrismaPromise<{ count: number }>
    }
    return delegate.deleteMany()
  })
  await prisma.$transaction(deletes)

  const passwordHash = await bcrypt.hash(adminPassword, 10)
  await prisma.user.create({
    data: {
      name: adminName,
      email: adminEmail,
      passwordHash,
      authProvider: 'EMAIL',
    },
  })

  console.log('Seed complete.')
  console.log(`Admin login: ${adminEmail}`)
  console.log('The password was read from SEED_ADMIN_PASSWORD and is not stored in this repository.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
