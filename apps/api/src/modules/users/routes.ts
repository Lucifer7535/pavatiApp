import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { Prisma } from '@prisma/client'
import { prisma, prismaPublic } from '../../lib/prisma.js'
import { AppError, asyncHandler, ok } from '../../lib/http.js'
import { requireAuth, type AuthedRequest } from '../../middleware/auth.js'
import { validateBody } from '../../middleware/validate.js'
import { changePasswordSchema, updateProfileSchema } from '@pavati/shared'
import { publicUser } from '../../lib/jwt.js'
import { resetLoginFailures, clientIp } from '../../middleware/rateLimit.js'

const router = Router()

router.use(requireAuth)

router.patch(
  '/me',
  validateBody(updateProfileSchema),
  asyncHandler(async (req: AuthedRequest, res) => {
    const body = req.body
    const changingContact = body.phone !== undefined || body.email !== undefined
    if (changingContact) {
      // A contact value is only usable as an identifier once the account has proven it
      // holds that contact, so a change requires re-authentication and must not collide
      // with another account.
      const current = await prisma.user.findUnique({ where: { id: req.user!.id } })
      const claimed = await prisma.user.findFirst({
        where: {
          id: { not: req.user!.id },
          OR: [
            ...(body.phone ? [{ phone: body.phone }] : []),
            ...(body.email ? [{ email: body.email }] : []),
          ],
        },
        select: { id: true },
      })
      if (claimed) throw new AppError(409, 'An account with this email or phone already exists')
      if (!current?.passwordHash || !(await bcrypt.compare(String(body.currentPassword ?? ''), current.passwordHash))) {
        throw new AppError(403, 'Changing your email or phone requires your current password')
      }
    }
    const user = await prismaPublic.user.update({
      where: { id: req.user!.id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        // The new value only regains trust as an identifier after re-verification, so the
        // verified marker is cleared rather than carried over.
        ...(body.phone !== undefined && { phone: body.phone, phoneVerifiedAt: null }),
        ...(body.email !== undefined && { email: body.email, emailVerifiedAt: null }),
        ...(body.profileImage !== undefined && { profileImage: body.profileImage }),
      },
    })
    ok(res, publicUser(user))
  })
)

router.post(
  '/me/change-password',
  validateBody(changePasswordSchema),
  asyncHandler(async (req: AuthedRequest, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } })
    if (!user?.passwordHash) throw new AppError(400, 'Account does not use a password. Log in with phone or Google instead.')
    if (!(await bcrypt.compare(req.body.currentPassword, user.passwordHash))) throw new AppError(400, 'Current password is incorrect')
    const passwordHash = await bcrypt.hash(req.body.newPassword, 10)
    // Revoke every outstanding session and bump the credential version in the same
    // transaction, so a password change ends live sessions instead of leaving them
    // usable for the token's remaining lifetime.
    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { passwordHash, tokenVersion: { increment: 1 } } }),
      prisma.refreshToken.updateMany({ where: { userId: user.id, revoked: false }, data: { revoked: true } }),
    ])
    // Proving control of the password is also proof the account holder is present.
    resetLoginFailures(clientIp(req), user.email ?? '')
    ok(res, { message: 'Password changed. All other sessions have been signed out.' })
  })
)

router.get(
  '/me/donations',
  asyncHandler(async (req: AuthedRequest, res) => {
    // Bind the read to the authenticated principal, not to mutable contact strings: a
    // user could otherwise set their own phone/email to a victim's and read that
    // person's donation history.
    //
    // No code path currently sets `phoneVerifiedAt`/`emailVerifiedAt` — the only writer
    // clears them on contact change — so these two branches are inert today and the
    // read resolves through `donorUserId` alone. They stay gated rather than being
    // removed so a future contact-verification flow cannot silently open impersonation.
    const { phone, email } = req.user!
    const contact: Array<{ phone: string } | { email: string }> = [
      ...(phone && req.user!.phoneVerifiedAt ? [{ phone }] : []),
      ...(email && req.user!.emailVerifiedAt ? [{ email }] : []),
    ]
    const owned: Prisma.DonationWhereInput = { donorUserId: req.user!.id }
    const where: Prisma.DonationWhereInput = contact.length ? { OR: [owned, ...contact] } : owned
    const page = Math.max(1, Number(req.query.page) || 1)
    const pageSize = Math.min(200, Math.max(1, Number(req.query.pageSize) || 50))
    const [total, donations] = await Promise.all([
      prismaPublic.donation.count({ where }),
      prismaPublic.donation.findMany({
        where,
        // Explicit whitelist: receipt rows are reachable publicly and must not be
        // forwarded wholesale through this response.
        select: {
          id: true, trustId: true, donorName: true, amount: true, category: true,
          paymentMode: true, donationDate: true, status: true, privacy: true,
          trust: { select: { id: true, name: true, logoUrl: true } },
          receipts: { select: { id: true, receiptNumber: true, status: true, generatedAt: true } },
        },
        orderBy: { donationDate: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ])
    ok(res, { total, page, pageSize, items: donations })
  })
)

router.get(
  '/me/memberships',
  asyncHandler(async (req: AuthedRequest, res) => {
    const memberships = await prismaPublic.trustMember.findMany({
      // Membership lifecycle predicate, matching the canonical implementations.
      where: { userId: req.user!.id, status: 'ACTIVE' },
      select: {
        id: true, trustId: true, userId: true, role: true, status: true, joinedAt: true,
        // Explicit whitelist matching lib/session.ts. joinCode is deliberately absent —
        // it belongs only behind the isMember test in trusts/routes.ts.
        trust: {
          select: {
            id: true, name: true, uniqueCode: true, logoUrl: true,
            festivalTypes: true, city: true,
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    })
    ok(res, memberships)
  })
)

export default router
