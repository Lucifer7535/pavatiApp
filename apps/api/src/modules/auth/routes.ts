import { Router } from 'express'
import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import { OAuth2Client } from 'google-auth-library'
import { prisma } from '../../lib/prisma.js'
import { AppError, asyncHandler, ok } from '../../lib/http.js'
import { sendEmail } from '../../lib/email.js'
import { requireAuth, type AuthedRequest } from '../../middleware/auth.js'
import { validateBody } from '../../middleware/validate.js'
import { authRateLimiter, loginRateLimiter, registerRateLimiter, assertNotLocked, recordLoginFailure, resetLoginFailures } from '../../middleware/rateLimit.js'
import {
  forgotPasswordSchema,
  googleAuthSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from '@pavati/shared'
import { config } from '../../config/index.js'
import { publicUser, verifyRefreshToken } from '../../lib/jwt.js'
import { buildAuthResponse, createRefreshRecord } from '../../lib/session.js'
import { audit } from '../../services/audit.js'

const router = Router()

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)
}

const googleOAuthClient = () => new OAuth2Client(config.googleClientId)

async function findOrCreateUser(data: { email: string; name: string; profileImage?: string | null }) {
  let user = await prisma.user.findUnique({ where: { email: data.email } })
  if (!user) {
    user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        authProvider: 'GOOGLE',
        profileImage: data.profileImage ?? null,
      },
    })
    await audit({ actorId: user.id, action: 'REGISTER' })
  }
  return user
}

router.post(
  '/register',
  registerRateLimiter(),
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
  loginRateLimiter(),
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body
    assertNotLocked(email)
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user?.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
      recordLoginFailure(email)
      throw new AppError(401, 'Invalid email or password')
    }
    resetLoginFailures(email)
    await audit({ actorId: user.id, action: 'LOGIN' })
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
    const { idToken } = req.body
    let email: string
    let name: string
    let picture: string | undefined

    if (config.mockMode && config.env !== 'production') {
      const profile = req.body.profile
      email = profile?.email ?? `${idToken.slice(0, 12)}@mock.google`
      name = profile?.name ?? 'Google User'
      picture = profile?.picture
    } else {
      if (config.mockMode && config.env === 'production') {
        throw new AppError(403, 'Mock mode is disabled in production')
      }
      if (!config.googleClientId) throw new AppError(503, 'Google login is not configured')
      try {
        const ticket = await googleOAuthClient().verifyIdToken({ idToken, audience: config.googleClientId })
        const payload = ticket.getPayload()
        if (!payload?.email) throw new AppError(401, 'Google account has no email')
        if (!payload.email_verified) throw new AppError(401, 'Google email is not verified')
        email = payload.email
        name = payload.name ?? 'Google User'
        picture = payload.picture
      } catch (e) {
        if (e instanceof AppError) throw e
        throw new AppError(401, 'Invalid Google token')
      }
    }

    const user = await findOrCreateUser({
      email,
      name,
      profileImage: picture ?? null,
    })
    await audit({ actorId: user.id, action: 'LOGIN' })
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
      await sendEmail({
        to: email,
        subject: 'Reset your Pāvati Pustak password',
        html: `<p>Hi ${escapeHtml(user.name ?? '')},</p><p>Click the link below to reset your password. This link expires in 30 minutes.</p><p><a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background:#831843;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">Reset Password</a></p><p>Or copy this URL: ${resetUrl}</p><p>If you didn't request this, ignore this email.</p>`,
        text: `Reset your password: ${resetUrl}`,
      })
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
        trust: { id: m.trust.id, name: m.trust.name, logoUrl: m.trust.logoUrl, uniqueCode: m.trust.uniqueCode, festivalTypes: m.trust.festivalTypes, city: m.trust.city, upiId: m.trust.upiId },
      })),
    })
  })
)

export default router