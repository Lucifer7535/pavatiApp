import { Router } from 'express'
import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import { prisma } from '../../lib/prisma.js'
import { AppError, asyncHandler, ok } from '../../lib/http.js'
import { requireAuth, type AuthedRequest } from '../../middleware/auth.js'
import { validateBody } from '../../middleware/validate.js'
import { authRateLimiter, otpRateLimiter } from '../../middleware/rateLimit.js'
import {
  forgotPasswordSchema,
  googleAuthSchema,
  loginSchema,
  registerSchema,
  requestOtpSchema,
  resetPasswordSchema,
  verifyOtpSchema,
} from '@pavati/shared'
import { config } from '../../config/index.js'
import { otpProvider } from '../../providers/otp.js'
import { publicUser, verifyRefreshToken } from '../../lib/jwt.js'
import { buildAuthResponse, createRefreshRecord } from '../../lib/session.js'
import { audit } from '../../services/audit.js'

const router = Router()

async function findOrCreateUser(data: { phone?: string; email?: string; name: string; authProvider: 'PHONE' | 'EMAIL' | 'GOOGLE'; profileImage?: string | null }) {
  let user = data.phone
    ? await prisma.user.findUnique({ where: { phone: data.phone } })
    : data.email
      ? await prisma.user.findUnique({ where: { email: data.email } })
      : null
  if (!user) {
    user = await prisma.user.create({
      data: {
        name: data.name,
        phone: data.phone ?? null,
        email: data.email ?? null,
        authProvider: data.authProvider,
        profileImage: data.profileImage ?? null,
      },
    })
    await audit({ actorId: user.id, action: 'REGISTER' })
  }
  return user
}

router.post(
  '/register',
  authRateLimiter(),
  validateBody(registerSchema),
  asyncHandler(async (req, res) => {
    const { name, email, password, phone } = req.body
    const existing = await prisma.user.findFirst({ where: { OR: [{ email }, ...(phone ? [{ phone }] : [])] } })
    if (existing) throw new AppError(409, 'An account with this email or phone already exists')
    const passwordHash = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({
      data: { name, email, passwordHash, phone: phone || null, authProvider: 'EMAIL' },
    })
    await audit({ actorId: user.id, action: 'REGISTER' })
    const session = await buildAuthResponse(user)
    await createRefreshRecord(user.id, session.refreshToken)
    ok(res, session, 201)
  })
)

router.post(
  '/login',
  authRateLimiter(),
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user?.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new AppError(401, 'Invalid email or password')
    }
    await audit({ actorId: user.id, action: 'LOGIN' })
    const session = await buildAuthResponse(user)
    await createRefreshRecord(user.id, session.refreshToken)
    ok(res, session)
  })
)

router.post(
  '/phone/request-otp',
  otpRateLimiter(),
  validateBody(requestOtpSchema),
  asyncHandler(async (req, res) => {
    const { phone } = req.body
    const otp = otpProvider.generate()
    const codeHash = crypto.createHash('sha256').update(otp).digest('hex')
    await prisma.otpCode.deleteMany({ where: { phone, purpose: 'LOGIN' } })
    await prisma.otpCode.create({
      data: { phone, codeHash, purpose: 'LOGIN', expiresAt: new Date(Date.now() + 5 * 60 * 1000) },
    })
    const sent = await otpProvider.send(phone, otp)
    ok(res, {
      message: 'OTP sent',
      expiresIn: 300,
      ...(config.mockMode ? { devOtp: sent.devCode } : {}),
    })
  })
)

router.post(
  '/phone/verify',
  authRateLimiter(),
  validateBody(verifyOtpSchema),
  asyncHandler(async (req, res) => {
    const { phone, otp } = req.body
    const record = await prisma.otpCode.findFirst({
      where: { phone, purpose: 'LOGIN', consumed: false },
      orderBy: { createdAt: 'desc' },
    })
    if (!record) throw new AppError(400, 'No OTP request found. Please request a new OTP.')
    if (record.expiresAt < new Date()) throw new AppError(400, 'OTP expired. Please request a new one.')
    const hash = crypto.createHash('sha256').update(otp).digest('hex')
    if (hash !== record.codeHash) {
      await prisma.otpCode.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } })
      throw new AppError(400, 'Invalid OTP')
    }
    await prisma.otpCode.update({ where: { id: record.id }, data: { consumed: true } })
    const user = await findOrCreateUser({ phone, name: 'New User', authProvider: 'PHONE' })
    const session = await buildAuthResponse(user)
    await createRefreshRecord(user.id, session.refreshToken)
    ok(res, session)
  })
)

router.post(
  '/google',
  authRateLimiter(),
  validateBody(googleAuthSchema),
  asyncHandler(async (req, res) => {
    const { profile } = req.body
    const email = profile?.email ?? `${req.body.idToken.slice(0, 12)}@mock.google`
    const user = await findOrCreateUser({
      email,
      name: profile?.name ?? 'Google User',
      authProvider: 'GOOGLE',
      profileImage: profile?.picture ?? null,
    })
    const session = await buildAuthResponse(user)
    await createRefreshRecord(user.id, session.refreshToken)
    ok(res, session)
  })
)

router.post(
  '/forgot-password',
  authRateLimiter(),
  validateBody(forgotPasswordSchema),
  asyncHandler(async (req, res) => {
    const { email } = req.body
    const user = await prisma.user.findUnique({ where: { email } })
    if (user) {
      const token = jwt.sign({ sub: user.id, type: 'reset' }, config.jwtSecret, { expiresIn: '30m' })
      const resetUrl = `${config.webOrigin}/reset-password?token=${token}`
      if (config.mockMode) {
        ok(res, { message: 'Password reset link sent', devResetUrl: resetUrl })
        return
      }
    }
    ok(res, { message: 'If an account exists with that email, a reset link has been sent.' })
  })
)

router.post(
  '/reset-password',
  authRateLimiter(),
  validateBody(resetPasswordSchema),
  asyncHandler(async (req, res) => {
    const { token, password } = req.body
    let payload: { sub: string; type: string }
    try {
      payload = jwt.verify(token, config.jwtSecret) as { sub: string; type: string }
    } catch {
      throw new AppError(400, 'Invalid or expired reset token')
    }
    if (payload.type !== 'reset') throw new AppError(400, 'Invalid token')
    const passwordHash = await bcrypt.hash(password, 10)
    await prisma.user.update({ where: { id: payload.sub }, data: { passwordHash } })
    ok(res, { message: 'Password updated. You can now log in.' })
  })
)

router.post(
  '/refresh',
  authRateLimiter(),
  asyncHandler(async (req, res) => {
    const token = req.body?.refreshToken as string | undefined
    if (!token) throw new AppError(401, 'Refresh token required')
    const payload = verifyRefreshToken(token)
    if (payload.type !== 'refresh') throw new AppError(401, 'Invalid token type')
    const hash = crypto.createHash('sha256').update(token).digest('hex')
    const record = await prisma.refreshToken.findFirst({ where: { tokenHash: hash, revoked: false } })
    if (!record || record.expiresAt < new Date()) throw new AppError(401, 'Refresh token revoked or expired')
    const user = await prisma.user.findUnique({ where: { id: payload.sub } })
    if (!user) throw new AppError(401, 'User not found')
    const session = await buildAuthResponse(user)
    await prisma.refreshToken.update({ where: { id: record.id }, data: { revoked: true } })
    await createRefreshRecord(user.id, session.refreshToken)
    ok(res, session)
  })
)

router.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const token = req.body?.refreshToken as string | undefined
    if (token) {
      const hash = crypto.createHash('sha256').update(token).digest('hex')
      await prisma.refreshToken.updateMany({ where: { tokenHash: hash }, data: { revoked: true } })
    }
    ok(res, { message: 'Logged out' })
  })
)

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const memberships = await prisma.trustMember.findMany({
      where: { userId: req.user!.id, status: 'ACTIVE' },
      include: { trust: true },
    })
    ok(res, {
      user: publicUser(req.user!),
      memberships: memberships.map((m) => ({
        id: m.id,
        trustId: m.trustId,
        role: m.role,
        trust: { id: m.trust.id, name: m.trust.name, logoUrl: m.trust.logoUrl, uniqueCode: m.trust.uniqueCode, festivalTypes: m.trust.festivalTypes, city: m.trust.city },
      })),
    })
  })
)

export default router