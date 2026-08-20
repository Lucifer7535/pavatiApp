import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { prisma } from '../../lib/prisma.js'
import { AppError, asyncHandler, ok } from '../../lib/http.js'
import { requireAuth, type AuthedRequest } from '../../middleware/auth.js'
import { validateBody } from '../../middleware/validate.js'
import { changePasswordSchema, updateProfileSchema } from '@pavati/shared'
import { publicUser } from '../../lib/jwt.js'

const router = Router()

router.use(requireAuth)

router.patch(
  '/me',
  validateBody(updateProfileSchema),
  asyncHandler(async (req: AuthedRequest, res) => {
    const body = req.body
    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.phone !== undefined && { phone: body.phone }),
        ...(body.email !== undefined && { email: body.email }),
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
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } })
    ok(res, { message: 'Password changed' })
  })
)

router.get(
  '/me/donations',
  asyncHandler(async (req: AuthedRequest, res) => {
    const donations = await prisma.donation.findMany({
      where: { OR: [{ phone: req.user!.phone ?? undefined }, { email: req.user!.email ?? undefined }] },
      include: { trust: { select: { id: true, name: true, logoUrl: true } }, receipts: true },
      orderBy: { donationDate: 'desc' },
      take: 200,
    })
    ok(res, donations)
  })
)

router.get(
  '/me/memberships',
  asyncHandler(async (req: AuthedRequest, res) => {
    const memberships = await prisma.trustMember.findMany({
      where: { userId: req.user!.id },
      include: { trust: true },
      orderBy: { joinedAt: 'asc' },
    })
    ok(res, memberships)
  })
)

export default router