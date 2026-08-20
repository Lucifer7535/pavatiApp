import type { NextFunction, Request, Response } from 'express'
import type { User } from '@prisma/client'
import { AppError } from '../lib/http.js'
import { verifyAccessToken } from '../lib/jwt.js'
import { prisma } from '../lib/prisma.js'

export interface AuthedRequest extends Request {
  user?: User
}

export async function requireAuth(req: AuthedRequest, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization
    if (!header?.startsWith('Bearer ')) throw new AppError(401, 'Authentication required')
    const payload = verifyAccessToken(header.slice(7))
    if (payload.type !== 'access') throw new AppError(401, 'Invalid token type')
    const user = await prisma.user.findUnique({ where: { id: payload.sub } })
    if (!user) throw new AppError(401, 'User not found')
    req.user = user
    next()
  } catch (e) {
    if (e instanceof AppError) return next(e)
    next(new AppError(401, 'Invalid or expired token'))
  }
}