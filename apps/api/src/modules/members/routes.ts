import { Router } from 'express'
import { randomBytes } from 'node:crypto'
import { prisma } from '../../lib/prisma.js'
import { AppError, asyncHandler, ok } from '../../lib/http.js'
import { requireAuth } from '../../middleware/auth.js'
import { loadTrustContext, requirePermission, type TrustContextRequest } from '../../middleware/rbac.js'
import { validateBody, validateParams } from '../../middleware/validate.js'
import { addMemberSchema, updateMemberSchema, z } from '@pavati/shared'
import { config } from '../../config/index.js'
import { audit } from '../../services/audit.js'

const router = Router()
const paramsId = z.object({ trustId: z.string().uuid(), memberId: z.string().uuid() })

router.use('/:trustId/members', requireAuth, loadTrustContext)

router.get(
  '/:trustId/members',
  requirePermission('member:view'),
  asyncHandler(async (req: TrustContextRequest, res) => {
    const q = String(req.query.q ?? '').trim()
    const where: Record<string, unknown> = { trustId: req.trustId, status: { not: 'REMOVED' } }
    if (q) where.user = { name: { contains: q, mode: 'insensitive' } }
    const members = await prisma.trustMember.findMany({
      where,
      include: { user: true },
      orderBy: { joinedAt: 'asc' },
    })
    ok(res, members.map((m) => ({ id: m.id, trustId: m.trustId, userId: m.userId, role: m.role, permissions: m.permissions, status: m.status, position: m.position, contactVisible: m.contactVisible, introduction: m.introduction, joinedAt: m.joinedAt, user: m.user })))
  })
)

router.post(
  '/:trustId/members',
  requirePermission('member:add'),
  validateBody(addMemberSchema),
  asyncHandler(async (req: TrustContextRequest, res) => {
    const body = req.body
    let user = body.userId ? await prisma.user.findUnique({ where: { id: body.userId } }) : null
    if (!user && body.email) user = await prisma.user.findUnique({ where: { email: body.email } })
    if (!user && body.phone) user = await prisma.user.findUnique({ where: { phone: body.phone } })
    if (!user) {
      if (!body.name) throw new AppError(400, 'Provide a name to create a new member account')
      user = await prisma.user.create({
        data: {
          name: body.name,
          email: body.email ?? null,
          phone: body.phone ?? null,
          authProvider: body.email ? 'EMAIL' : 'PHONE',
        },
      })
    }
    const existing = await prisma.trustMember.findUnique({ where: { trustId_userId: { trustId: req.trustId!, userId: user.id } } })
    if (existing) {
      if (existing.status === 'REMOVED') {
        const member = await prisma.trustMember.update({
          where: { id: existing.id },
          data: { status: 'ACTIVE', role: body.role, position: body.position ?? null, introduction: body.introduction ?? null, contactVisible: body.contactVisible ?? false },
        })
        await audit({ actorId: req.user!.id, trustId: req.trustId, action: 'MEMBER_ADDED', entityType: 'TrustMember', entityId: member.id, metadata: { role: body.role, userId: user.id } })
        ok(res, { member, user }, 201)
        return
      }
      throw new AppError(409, 'User is already a member')
    }
    const member = await prisma.trustMember.create({
      data: {
        trustId: req.trustId!,
        userId: user.id,
        role: body.role,
        position: body.position ?? null,
        introduction: body.introduction ?? null,
        contactVisible: body.contactVisible ?? false,
      },
    })
    await audit({ actorId: req.user!.id, trustId: req.trustId, action: 'MEMBER_ADDED', entityType: 'TrustMember', entityId: member.id, metadata: { role: body.role, userId: user.id } })
    ok(res, { member, user }, 201)
  })
)

router.patch(
  '/:trustId/members/:memberId',
  requirePermission('member:manage_roles'),
  validateParams(paramsId),
  validateBody(updateMemberSchema),
  asyncHandler(async (req: TrustContextRequest, res) => {
    const member = await prisma.trustMember.findUnique({ where: { id: req.params.memberId } })
    if (!member || member.trustId !== req.trustId) throw new AppError(404, 'Member not found')
    if (member.role === 'PRIMARY_ADMIN' && req.body.role && req.body.role !== 'PRIMARY_ADMIN') {
      throw new AppError(400, 'The Primary Admin role cannot be changed')
    }
    const updated = await prisma.trustMember.update({
      where: { id: member.id },
      data: {
        ...(req.body.role !== undefined && { role: req.body.role }),
        ...(req.body.position !== undefined && { position: req.body.position }),
        ...(req.body.introduction !== undefined && { introduction: req.body.introduction }),
        ...(req.body.contactVisible !== undefined && { contactVisible: req.body.contactVisible }),
        ...(req.body.permissions !== undefined && { permissions: req.body.permissions }),
      },
      include: { user: true },
    })
    await audit({ actorId: req.user!.id, trustId: req.trustId, action: 'MEMBER_ROLE_CHANGED', entityType: 'TrustMember', entityId: member.id, metadata: { to: req.body } })
    ok(res, updated)
  })
)

router.delete(
  '/:trustId/members/:memberId',
  requirePermission('member:remove'),
  validateParams(paramsId),
  asyncHandler(async (req: TrustContextRequest, res) => {
    const member = await prisma.trustMember.findUnique({ where: { id: req.params.memberId } })
    if (!member || member.trustId !== req.trustId) throw new AppError(404, 'Member not found')
    if (member.role === 'PRIMARY_ADMIN') throw new AppError(400, 'The Primary Admin cannot be removed')
    if (member.userId === req.user!.id) throw new AppError(400, 'You cannot remove yourself')
    await prisma.trustMember.update({ where: { id: member.id }, data: { status: 'REMOVED' } })
    await audit({ actorId: req.user!.id, trustId: req.trustId, action: 'MEMBER_REMOVED', entityType: 'TrustMember', entityId: member.id })
    ok(res, { message: 'Member removed' })
  })
)

router.post(
  '/:trustId/members/invite',
  requirePermission('member:invite'),
  validateBody(z.object({ email: z.string().email().optional(), phone: z.string().optional(), role: z.enum(['MEMBER', 'VOLUNTEER', 'COLLECTOR', 'COMMITTEE_MEMBER']).default('MEMBER') })),
  asyncHandler(async (req: TrustContextRequest, res) => {
    const token = randomBytes(12).toString('hex')
    await prisma.trustInvite.create({
      data: {
        trustId: req.trustId!,
        email: req.body.email ?? null,
        phone: req.body.phone ?? null,
        token,
        role: req.body.role,
        createdById: req.user!.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    })
    const inviteUrl = `${config.webOrigin}/join?invite=${token}`
    ok(res, { inviteUrl, token, message: 'Invitation created' }, 201)
  })
)

router.post(
  '/:trustId/join/invite',
  requireAuth,
  validateBody(z.object({ token: z.string().min(8) })),
  asyncHandler(async (req: TrustContextRequest, res) => {
    const invite = await prisma.trustInvite.findUnique({ where: { token: req.body.token } })
    if (!invite || invite.trustId !== req.params.trustId) throw new AppError(404, 'Invitation not found')
    if (invite.used || (invite.expiresAt && invite.expiresAt < new Date())) throw new AppError(400, 'Invitation expired or already used')
    await prisma.trustInvite.update({ where: { id: invite.id }, data: { used: true } })
    const member = await prisma.trustMember.upsert({
      where: { trustId_userId: { trustId: invite.trustId, userId: req.user!.id } },
      create: { trustId: invite.trustId, userId: req.user!.id, role: invite.role },
      update: { status: 'ACTIVE' },
    })
    await audit({ actorId: req.user!.id, trustId: invite.trustId, action: 'MEMBER_ADDED', entityType: 'TrustMember', entityId: member.id, metadata: { via: 'invite' } })
    ok(res, { message: 'Invitation accepted', member })
  })
)

router.get(
  '/:trustId/join-requests',
  requirePermission('member:view'),
  asyncHandler(async (req: TrustContextRequest, res) => {
    const requests = await prisma.joinRequest.findMany({
      where: { trustId: req.trustId, status: 'PENDING' },
      include: { trust: true },
      orderBy: { createdAt: 'asc' },
    })
    const userIds = requests.map((r) => r.userId)
    const users = await prisma.user.findMany({ where: { id: { in: userIds } } })
    ok(res, requests.map((r) => ({ id: r.id, userId: r.userId, message: r.message, createdAt: r.createdAt, user: users.find((u) => u.id === r.userId) })))
  })
)

router.post(
  '/:trustId/join-requests/:requestId',
  requirePermission('member:manage_roles'),
  validateParams(z.object({ trustId: z.string().uuid(), requestId: z.string().uuid() })),
  validateBody(z.object({ decision: z.enum(['APPROVE', 'REJECT']) })),
  asyncHandler(async (req: TrustContextRequest, res) => {
    const request = await prisma.joinRequest.findUnique({ where: { id: req.params.requestId } })
    if (!request || request.trustId !== req.trustId) throw new AppError(404, 'Join request not found')
    if (req.body.decision === 'APPROVE') {
      await prisma.joinRequest.update({ where: { id: request.id }, data: { status: 'APPROVED' } })
      const member = await prisma.trustMember.create({
        data: { trustId: req.trustId!, userId: request.userId, role: 'MEMBER' },
      })
      await audit({ actorId: req.user!.id, trustId: req.trustId, action: 'MEMBER_ADDED', entityType: 'TrustMember', entityId: member.id, metadata: { via: 'join_request' } })
      ok(res, { message: 'Approved', member })
    } else {
      await prisma.joinRequest.update({ where: { id: request.id }, data: { status: 'REJECTED' } })
      ok(res, { message: 'Rejected' })
    }
  })
)

export default router