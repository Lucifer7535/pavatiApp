import type { NextFunction, Response } from 'express'
import type { TrustMember } from '@prisma/client'
import { permissionsForRole, type Permission } from '@pavati/shared'
import { AppError } from '../lib/http.js'
import { prisma } from '../lib/prisma.js'
import type { AuthedRequest } from './auth.js'

export interface TrustContextRequest extends AuthedRequest {
  trustMember?: TrustMember
  effectivePermissions?: Permission[]
  trustId?: string
}

function extractTrustId(req: TrustContextRequest): string | undefined {
  const candidates = [req.params.trustId, req.body?.trustId, req.query?.trustId, req.params.id]
  for (const c of candidates) {
    if (typeof c === 'string' && c) return c
  }
  return undefined
}

export function effectivePermissionsFor(member: TrustMember): Permission[] {
  if (member.permissions && member.permissions.length > 0) {
    return member.permissions as Permission[]
  }
  return permissionsForRole(member.role)
}

export async function loadTrustContext(req: TrustContextRequest, _res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required')
    const trustId = extractTrustId(req)
    if (!trustId) return next()
    req.trustId = trustId
    const member = await prisma.trustMember.findUnique({
      where: { trustId_userId: { trustId, userId: req.user.id } },
    })
    if (!member) throw new AppError(403, 'You are not a member of this trust')
    if (member.status !== 'ACTIVE') throw new AppError(403, 'Your membership is not active')
    req.trustMember = member
    req.effectivePermissions = effectivePermissionsFor(member)
    next()
  } catch (e) {
    next(e)
  }
}

export function requirePermission(permission: Permission | Permission[]) {
  const perms = Array.isArray(permission) ? permission : [permission]
  return (req: TrustContextRequest, _res: Response, next: NextFunction) => {
    const has = req.effectivePermissions
    if (!has || !perms.some((p) => has.includes(p))) {
      return next(new AppError(403, `Missing permission: ${perms.join(' or ')}`))
    }
    next()
  }
}

export async function requireTrustAccess(req: TrustContextRequest, _res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required')
    const trustId = extractTrustId(req)
    if (!trustId) throw new AppError(400, 'trustId is required')
    req.trustId = trustId
    const member = await prisma.trustMember.findUnique({
      where: { trustId_userId: { trustId, userId: req.user.id } },
    })
    if (!member || member.status !== 'ACTIVE') throw new AppError(403, 'You are not an active member of this trust')
    req.trustMember = member
    req.effectivePermissions = effectivePermissionsFor(member)
    next()
  } catch (e) {
    next(e)
  }
}