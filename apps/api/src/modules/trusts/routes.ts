import { Router } from 'express'
import { prisma } from '../../lib/prisma.js'
import { AppError, asyncHandler, ok } from '../../lib/http.js'
import { requireAuth, optionalAuth, type AuthedRequest } from '../../middleware/auth.js'
import { loadTrustContext, requirePermission, type TrustContextRequest } from '../../middleware/rbac.js'
import { validateBody, validateParams } from '../../middleware/validate.js'
import { createTrustSchema, joinByCodeSchema, updateTrustSchema, z, randomCode } from '@pavati/shared'
import { audit } from '../../services/audit.js'
import { publicUser } from '../../lib/jwt.js'

const router = Router()

function buildCodes(name: string): { uniqueCode: string; joinCode: string } {
  const word = name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase() || 'TRUST'
  const year = new Date().getFullYear()
  return {
    uniqueCode: `${word}${year}`,
    joinCode: `${word}${year}${randomCode(3)}`,
  }
}

router.post(
  '/',
  requireAuth,
  validateBody(createTrustSchema),
  asyncHandler(async (req: AuthedRequest, res) => {
    const body = req.body
    const { uniqueCode, joinCode } = buildCodes(body.name)
    const trust = await prisma.trust.create({
      data: {
        name: body.name,
        uniqueCode,
        joinCode,
        logoUrl: body.logoUrl ?? null,
        festivalTypes: body.festivalTypes,
        description: body.description ?? null,
        registrationNumber: body.registrationNumber ?? null,
        address: body.address ?? null,
        city: body.city ?? null,
        state: body.state ?? null,
        country: body.country ?? null,
        pinCode: body.pinCode ?? null,
        contactPhone: body.contactPhone ?? null,
        contactEmail: body.contactEmail ?? null,
        website: body.website ?? null,
        upiId: body.upiId ?? null,
        financialYear: body.financialYear ?? null,
        festivalStartDate: body.festivalStartDate ? new Date(body.festivalStartDate) : null,
        festivalEndDate: body.festivalEndDate ? new Date(body.festivalEndDate) : null,
        joinMode: body.joinMode,
      },
    })
    const member = await prisma.trustMember.create({
      data: { trustId: trust.id, userId: req.user!.id, role: 'PRIMARY_ADMIN' },
    })
    await audit({ actorId: req.user!.id, trustId: trust.id, action: 'TRUST_CREATED', entityType: 'Trust', entityId: trust.id, metadata: { name: trust.name } })
    ok(res, { trust, member, joinCode: trust.joinCode, uniqueCode: trust.uniqueCode }, 201)
  })
)

router.get(
  '/search',
  asyncHandler(async (req, res) => {
    const q = String(req.query.q ?? '').trim()
    const city = String(req.query.city ?? '').trim()
    const where: Record<string, unknown> = {}
    if (q) where.OR = [{ name: { contains: q, mode: 'insensitive' } }, { description: { contains: q, mode: 'insensitive' } }]
    if (city) where.city = { contains: city, mode: 'insensitive' }
    const trusts = await prisma.trust.findMany({
      where,
      include: { _count: { select: { members: true } } },
      take: 50,
      orderBy: { createdAt: 'desc' },
    })
    ok(res, trusts.map((t) => ({ id: t.id, name: t.name, uniqueCode: t.uniqueCode, logoUrl: t.logoUrl, festivalTypes: t.festivalTypes, description: t.description, city: t.city, state: t.state, memberCount: t._count.members, joinMode: t.joinMode })))
  })
)

router.get(
  '/by-code/:code',
  validateParams(z.object({ code: z.string().min(3).max(20) })),
  asyncHandler(async (req, res) => {
    const trust = await prisma.trust.findFirst({
      where: { joinCode: { equals: req.params.code, mode: 'insensitive' } },
      include: { _count: { select: { members: true } } },
    })
    if (!trust) throw new AppError(404, 'Trust not found for this code')
    ok(res, { id: trust.id, name: trust.name, uniqueCode: trust.uniqueCode, logoUrl: trust.logoUrl, festivalTypes: trust.festivalTypes, description: trust.description, city: trust.city, state: trust.state, memberCount: trust._count.members, joinMode: trust.joinMode })
  })
)

router.get(
  '/:trustId',
  optionalAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const trust = await prisma.trust.findUnique({
      where: { id: req.params.trustId },
      include: { _count: { select: { members: true } } },
    })
    if (!trust) throw new AppError(404, 'Trust not found')
    let isMember = false
    if (req.user) {
      const member = await prisma.trustMember.findFirst({
        where: { trustId: trust.id, userId: req.user.id, status: 'ACTIVE' },
        select: { id: true },
      })
      isMember = !!member
    }
    const committee = trust.showCommitteePublicly
      ? await prisma.trustMember.findMany({
          where: { trustId: trust.id, status: 'ACTIVE', role: { in: ['PRIMARY_ADMIN', 'ADMIN', 'PRESIDENT', 'VICE_PRESIDENT', 'SECRETARY', 'JOINT_SECRETARY', 'TREASURER'] } },
          include: { user: true },
        })
      : []
    const donations = trust.showDonorsPublicly
      ? await prisma.donation.findMany({
          where: { trustId: trust.id, status: 'SUCCEEDED', privacy: 'PUBLIC' },
          orderBy: { donationDate: 'desc' },
          take: 100,
        })
      : []
    ok(res, {
      id: trust.id,
      name: trust.name,
      uniqueCode: trust.uniqueCode,
      joinCode: isMember ? trust.joinCode : undefined,
      logoUrl: trust.logoUrl,
      festivalTypes: trust.festivalTypes,
      description: trust.description,
      registrationNumber: trust.registrationNumber,
      address: trust.address,
      city: trust.city,
      state: trust.state,
      country: trust.country,
      pinCode: trust.pinCode,
      contactPhone: trust.contactPhone,
      contactEmail: trust.contactEmail,
      website: trust.website,
      upiId: trust.upiId,
      financialYear: trust.financialYear,
      festivalStartDate: trust.festivalStartDate,
      festivalEndDate: trust.festivalEndDate,
      joinMode: trust.joinMode,
      showCommitteePublicly: trust.showCommitteePublicly,
      showDonorsPublicly: trust.showDonorsPublicly,
      showDonationAmounts: trust.showDonationAmounts,
      allowAnonymousDonations: trust.allowAnonymousDonations,
      memberCount: trust._count.members,
      committee: committee.map((m) => ({ id: m.id, role: m.role, position: m.position, contactVisible: m.contactVisible, introduction: m.introduction, user: m.contactVisible ? publicUser(m.user) : { id: m.user.id, name: m.user.name, profileImage: m.user.profileImage } })),
      recentDonations: donations.map((d) => ({ id: d.id, donorName: d.privacy === 'ANONYMOUS' ? 'Anonymous Donor' : d.donorName, amount: trust.showDonationAmounts ? d.amount : null, donationDate: d.donationDate, category: d.category })),
    })
  })
)

router.post(
  '/:trustId/join',
  requireAuth,
  validateBody(joinByCodeSchema),
  asyncHandler(async (req: AuthedRequest, res) => {
    const trust = await prisma.trust.findUnique({ where: { id: req.params.trustId } })
    if (!trust) throw new AppError(404, 'Trust not found')
    // INVITE_ONLY always requires a valid code; OPEN/APPROVAL allow code-less one-tap join
    if (trust.joinMode === 'INVITE_ONLY') {
      if (!req.body.code) throw new AppError(400, 'A join code is required for this trust')
      if (trust.joinCode.toLowerCase() !== req.body.code.toLowerCase()) throw new AppError(400, 'Invalid join code')
    } else if (req.body.code) {
      // Optional code validation for OPEN/APPROVAL — if provided it must match
      if (trust.joinCode.toLowerCase() !== req.body.code.toLowerCase()) throw new AppError(400, 'Invalid join code')
    }
    const existing = await prisma.trustMember.findUnique({
      where: { trustId_userId: { trustId: trust.id, userId: req.user!.id } },
    })
    if (existing && existing.status !== 'REMOVED') throw new AppError(409, 'You are already a member of this trust')
    if (trust.joinMode === 'INVITE_ONLY') throw new AppError(403, 'This trust accepts members by invitation only')
    if (trust.joinMode === 'APPROVAL') {
      const joinRequest = await prisma.joinRequest.upsert({
        where: { trustId_userId: { trustId: trust.id, userId: req.user!.id } },
        create: { trustId: trust.id, userId: req.user!.id },
        update: { status: 'PENDING' },
      })
      ok(res, { message: 'Join request submitted for admin approval', status: 'PENDING_APPROVAL', joinRequest })
      return
    }
    const member = await prisma.trustMember.upsert({
      where: { trustId_userId: { trustId: trust.id, userId: req.user!.id } },
      create: { trustId: trust.id, userId: req.user!.id, role: 'MEMBER' },
      update: { status: 'ACTIVE' },
    })
    await audit({ actorId: req.user!.id, trustId: trust.id, action: 'MEMBER_ADDED', entityType: 'TrustMember', entityId: member.id })
    ok(res, { message: 'Joined successfully', member })
  })
)

router.get(
  '/:trustId/committee',
  asyncHandler(async (req: TrustContextRequest, res) => {
    const trust = await prisma.trust.findUnique({ where: { id: req.params.trustId } })
    if (!trust) throw new AppError(404, 'Trust not found')
    const showPublic = trust.showCommitteePublicly
    const committee = await prisma.trustMember.findMany({
      where: { trustId: trust.id, status: 'ACTIVE' },
      include: { user: true },
      orderBy: { joinedAt: 'asc' },
    })
    ok(res, committee.map((m) => ({ id: m.id, role: m.role, position: m.position, contactVisible: m.contactVisible, introduction: m.introduction, joinedAt: m.joinedAt, user: showPublic ? publicUser(m.user) : { id: m.user.id, name: m.user.name, profileImage: m.user.profileImage } })))
  })
)

router.delete(
  '/:trustId',
  requireAuth,
  loadTrustContext,
  asyncHandler(async (req: TrustContextRequest, res) => {
    if (req.trustMember!.role !== 'PRIMARY_ADMIN') throw new AppError(403, 'Only the trust creator can delete this trust')
    const trust = await prisma.trust.findUnique({ where: { id: req.trustId } })
    if (!trust) throw new AppError(404, 'Trust not found')
    await audit({ actorId: req.user!.id, trustId: req.trustId, action: 'TRUST_DELETED', entityType: 'Trust', entityId: req.trustId, metadata: { name: trust.name } })
    await prisma.trust.delete({ where: { id: req.trustId } })
    ok(res, { message: 'Trust deleted' })
  })
)

router.patch(
  '/:trustId',
  requireAuth,
  loadTrustContext,
  requirePermission('trust:update'),
  validateBody(updateTrustSchema),
  asyncHandler(async (req: TrustContextRequest, res) => {
    const data = req.body
    const trust = await prisma.trust.update({
      where: { id: req.trustId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.logoUrl !== undefined && { logoUrl: data.logoUrl }),
        ...(data.festivalTypes !== undefined && { festivalTypes: data.festivalTypes }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.registrationNumber !== undefined && { registrationNumber: data.registrationNumber }),
        ...(data.address !== undefined && { address: data.address }),
        ...(data.city !== undefined && { city: data.city }),
        ...(data.state !== undefined && { state: data.state }),
        ...(data.country !== undefined && { country: data.country }),
        ...(data.pinCode !== undefined && { pinCode: data.pinCode }),
        ...(data.contactPhone !== undefined && { contactPhone: data.contactPhone }),
        ...(data.contactEmail !== undefined && { contactEmail: data.contactEmail }),
        ...(data.website !== undefined && { website: data.website }),
        ...(data.upiId !== undefined && { upiId: data.upiId }),
        ...(data.financialYear !== undefined && { financialYear: data.financialYear }),
        ...(data.festivalStartDate !== undefined && { festivalStartDate: data.festivalStartDate ? new Date(data.festivalStartDate) : null }),
        ...(data.festivalEndDate !== undefined && { festivalEndDate: data.festivalEndDate ? new Date(data.festivalEndDate) : null }),
        ...(data.joinMode !== undefined && { joinMode: data.joinMode }),
      },
    })
    await audit({ actorId: req.user!.id, trustId: trust.id, action: 'TRUST_UPDATED', entityType: 'Trust', entityId: trust.id, metadata: { fields: Object.keys(data) } })
    ok(res, trust)
  })
)

export default router