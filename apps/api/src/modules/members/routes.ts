import { Router } from 'express'
import { randomBytes } from 'node:crypto'
import { prisma, prismaPublic } from '../../lib/prisma.js'
import { visibleUserMap } from '../../lib/userProjection.js'
import { AppError, asyncHandler, ok } from '../../lib/http.js'
import { requireAuth } from '../../middleware/auth.js'
import { loadTrustContext, requirePermission, type TrustContextRequest } from '../../middleware/rbac.js'
import { validateBody, validateParams } from '../../middleware/validate.js'
import { addMemberSchema, permissionsForRole, updateMemberSchema, z } from '@pavati/shared'
import { config } from '../../config/index.js'
import { audit } from '../../services/audit.js'

const router = Router()
const paramsId = z.object({ trustId: z.string().uuid(), memberId: z.string().uuid() })

const USER_SELECT = { id: true, name: true, profileImage: true, email: true, phone: true } as const

/**
 * An actor may only grant a role that does not exceed its own effective authority.
 *
 * Blocks a member:add-only principal (SECRETARY holds MEMBER_ADD but not
 * MEMBER_MANAGE_ROLES) from minting PRIMARY_ADMIN or ADMIN, and stops an ADMIN from
 * minting PRIMARY_ADMIN — which is a strict superset of its own permissions, and is the
 * row trust deletion and ownership transfer trust at trusts/routes.ts.
 */
function assertMayGrantRole(req: TrustContextRequest, requestedRole: string) {
  const actorPerms = new Set<string>(req.effectivePermissions ?? [])

  // PRIMARY_ADMIN is an ownership rank, not a delegable permission. It is granted only
  // by the ownership-transfer endpoint in trusts/routes.ts, which demotes the outgoing
  // owner in the same transaction. Creating a second PRIMARY_ADMIN row here would leave
  // the trust with two unremovable owners and bypass that single transfer path.
  if (requestedRole === 'PRIMARY_ADMIN') {
    throw new AppError(409, 'Ownership cannot be granted by adding a member. Use the ownership transfer endpoint.')
  }

  const isAdminLevel = requestedRole === 'ADMIN'
  if (isAdminLevel && !actorPerms.has('member:manage_roles')) {
    throw new AppError(403, `Missing permission: member:manage_roles (required to grant ${requestedRole})`)
  }
  const granted = permissionsForRole(requestedRole as never) as unknown as string[]
  for (const p of granted) {
    if (!actorPerms.has(p)) throw new AppError(403, `Cannot grant role ${requestedRole}: it exceeds your own permissions (${p})`)
  }
  if (!granted.length && !actorPerms.size) throw new AppError(403, 'You cannot grant roles')
}

router.use('/:trustId/members', requireAuth, loadTrustContext)

router.get(
  '/:trustId/members',
  requirePermission('member:view'),
  asyncHandler(async (req: TrustContextRequest, res) => {
    const q = String(req.query.q ?? '').trim()
    const where: Record<string, unknown> = { trustId: req.trustId, status: { not: 'REMOVED' } }
    if (q) where.user = { name: { contains: q, mode: 'insensitive' } }
    const members = await prismaPublic.trustMember.findMany({
      where,
      select: {
        id: true, trustId: true, userId: true, role: true, permissions: true,
        status: true, position: true, contactVisible: true, introduction: true, joinedAt: true,
        user: { select: USER_SELECT },
      },
      orderBy: { joinedAt: 'asc' },
    })
    const visible = await visibleUserMap(req.trustId!, members.map((m) => m.userId))
    ok(res, members.map((m) => ({ id: m.id, trustId: m.trustId, userId: m.userId, role: m.role, permissions: m.permissions, status: m.status, position: m.position, contactVisible: m.contactVisible, introduction: m.introduction, joinedAt: m.joinedAt, user: visible.get(m.userId)! })))
  })
)

router.post(
  '/:trustId/members',
  requirePermission('member:add'),
  validateBody(addMemberSchema),
  asyncHandler(async (req: TrustContextRequest, res) => {
    const body = req.body
    assertMayGrantRole(req, body.role)
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
        // Second write path into the same role column: re-apply the ceiling here too,
        // because this branch is what turns a revoked membership back into an active one.
        assertMayGrantRole(req, body.role)
        const member = await prisma.trustMember.update({
          where: { id: existing.id },
          data: { status: 'ACTIVE', role: body.role, position: body.position ?? null, introduction: body.introduction ?? null, contactVisible: body.contactVisible ?? false },
        })
        await audit({ actorId: req.user!.id, trustId: req.trustId, action: 'MEMBER_ADDED', entityType: 'TrustMember', entityId: member.id, metadata: { role: body.role, userId: user.id } })
        const visible = await visibleUserMap(req.trustId!, [user.id])
        ok(res, { member, user: visible.get(user.id)! }, 201)
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
    const visible = await visibleUserMap(req.trustId!, [user.id])
    ok(res, { member, user: visible.get(user.id)! }, 201)
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

    const touchesAuthority = req.body.role !== undefined || req.body.permissions !== undefined

    // Self-promotion guard. Scoped to authority fields so a member may still correct their
    // own position, introduction or contactVisible through this route.
    if (touchesAuthority && member.userId === req.user!.id) {
      throw new AppError(400, 'You cannot change your own role or permissions')
    }

    if (member.role === 'PRIMARY_ADMIN' && req.body.role && req.body.role !== 'PRIMARY_ADMIN') {
      throw new AppError(400, 'The Primary Admin role cannot be changed')
    }

    // PRIMARY_ADMIN is a strict superset of every other role and is the row trust deletion
    // and ownership transfer defer to. It can only be assigned by transfer-ownership.
    if (req.body.role === 'PRIMARY_ADMIN') {
      throw new AppError(400, 'Use transfer-ownership to assign the Primary Admin role')
    }

    if (req.body.role !== undefined) {
      assertMayGrantRole(req, req.body.role)
      if (req.trustMember!.role !== 'PRIMARY_ADMIN') {
        throw new AppError(403, 'Only the primary admin can assign roles')
      }
    }

    // A permissions override is an unbounded capability grant, so it requires both the
    // primary admin and that the actor already holds every permission being written.
    if (req.body.permissions !== undefined) {
      if (req.trustMember!.role !== 'PRIMARY_ADMIN') {
        throw new AppError(403, 'Only the primary admin can edit member permissions')
      }
      const actorPerms = new Set<string>(req.effectivePermissions ?? [])
      for (const p of req.body.permissions) {
        if (!actorPerms.has(p)) throw new AppError(403, `Cannot grant a permission you do not hold (${p})`)
      }
    }

    const updated = await prismaPublic.trustMember.update({
      where: { id: member.id },
      data: {
        ...(req.body.role !== undefined && { role: req.body.role }),
        ...(req.body.position !== undefined && { position: req.body.position }),
        ...(req.body.introduction !== undefined && { introduction: req.body.introduction }),
        ...(req.body.contactVisible !== undefined && { contactVisible: req.body.contactVisible }),
        ...(req.body.permissions !== undefined && { permissions: req.body.permissions }),
      },
      select: {
        id: true, trustId: true, userId: true, role: true, permissions: true,
        status: true, position: true, contactVisible: true, introduction: true, joinedAt: true,
        user: { select: USER_SELECT },
      },
    })
    await audit({ actorId: req.user!.id, trustId: req.trustId, action: 'MEMBER_ROLE_CHANGED', entityType: 'TrustMember', entityId: member.id, metadata: { to: req.body } })
    const visible = await visibleUserMap(req.trustId!, [updated.userId])
    ok(res, { ...updated, user: visible.get(updated.userId)! })
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
      // Restoring a REMOVED membership must not silently reinstate the revoked role.
      // A redemptor has proven only the identity the invite was addressed to, so the
      // membership comes back at the invite's role with the override cleared.
      update: { status: 'ACTIVE', role: invite.role, permissions: [] },
    })
    await audit({ actorId: req.user!.id, trustId: invite.trustId, action: 'MEMBER_ADDED', entityType: 'TrustMember', entityId: member.id, metadata: { via: 'invite', role: invite.role } })
    ok(res, { message: 'Invitation accepted', member })
  })
)

router.get(
  '/:trustId/join-requests',
  requirePermission('member:view'),
  asyncHandler(async (req: TrustContextRequest, res) => {
    const requests = await prismaPublic.joinRequest.findMany({
      where: { trustId: req.trustId, status: 'PENDING' },
      // Explicitly no `include: { trust: true }` here: the Trust row carries joinCode,
      // and this listing is readable by any member:view holder. The projection below
      // never referenced it, so it was an unmapped read of a secret-bearing row.
      orderBy: { createdAt: 'asc' },
    })
    const userIds = requests.map((r) => r.userId)
    const users = await prismaPublic.user.findMany({ where: { id: { in: userIds } }, select: USER_SELECT })
    const visible = await visibleUserMap(req.trustId!, userIds)
    ok(res, requests.map((r) => ({ id: r.id, userId: r.userId, message: r.message, createdAt: r.createdAt, user: visible.get(r.userId) ?? users.find((u) => u.id === r.userId) })))
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
      // Upsert, not create: a previously removed member still holds a TrustMember row,
      // so `create` raised a unique-constraint error here. Reuse the row and reset its
      // authority, so approval cannot reinstate a role that was revoked earlier.
      const member = await prisma.trustMember.upsert({
        where: { trustId_userId: { trustId: req.trustId!, userId: request.userId } },
        create: { trustId: req.trustId!, userId: request.userId, role: 'MEMBER' },
        update: { status: 'ACTIVE', role: 'MEMBER', permissions: [] },
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