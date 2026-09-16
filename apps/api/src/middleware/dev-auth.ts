import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { config } from '../config/index.js'
import { AppError } from '../lib/http.js'

export interface DevTokenPayload {
  sub: string
  type: 'developer'
}

declare global {
  namespace Express {
    interface Request {
      isDeveloper?: boolean
    }
  }
}

export function requireDevAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) throw new AppError(401, 'Developer authentication required')

  try {
    const payload = jwt.verify(header.slice(7), config.jwtSecret) as DevTokenPayload
    if (payload.type !== 'developer') throw new AppError(401, 'Invalid developer token')
    req.isDeveloper = true
    next()
  } catch {
    throw new AppError(401, 'Invalid or expired developer token')
  }
}
