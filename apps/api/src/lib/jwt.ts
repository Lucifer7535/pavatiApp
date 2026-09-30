import jwt from 'jsonwebtoken'
import type { User } from '@prisma/client'
import { config } from '../config/index.js'

export interface TokenPayload {
  sub: string
  type: 'access' | 'refresh'
  /** User.tokenVersion at issue time. Bumped on credential change to end live sessions. */
  ver: number
}

type ExpiresIn = jwt.SignOptions['expiresIn']

export function signAccessToken(user: Pick<User, 'id' | 'tokenVersion'>): string {
  return jwt.sign({ sub: user.id, type: 'access', ver: user.tokenVersion } satisfies TokenPayload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn as ExpiresIn,
  })
}

export function signRefreshToken(user: Pick<User, 'id' | 'tokenVersion'>): string {
  return jwt.sign({ sub: user.id, type: 'refresh', ver: user.tokenVersion } satisfies TokenPayload, config.refreshSecret, {
    expiresIn: '30d',
  })
}

export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, config.jwtSecret) as TokenPayload
}

export function verifyRefreshToken(token: string): TokenPayload {
  return jwt.verify(token, config.refreshSecret) as TokenPayload
}

export function publicUser(u: User) {
  return {
    id: u.id,
    name: u.name,
    phone: u.phone,
    email: u.email,
    profileImage: u.profileImage,
    authProvider: u.authProvider,
    createdAt: u.createdAt,
  }
}