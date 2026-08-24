import rateLimit from 'express-rate-limit'
import type { Request } from 'express'
import { AppError } from '../lib/http.js'

export function authRateLimiter() {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 60,
    message: { error: 'Too many requests. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
  })
}

function emailKey(req: Request): string {
  const body = (req.body ?? {}) as { email?: unknown }
  return typeof body.email === 'string' ? body.email.trim().toLowerCase() : 'unknown'
}

export function loginRateLimiter() {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    keyGenerator: (req) => `${req.ip}:${emailKey(req)}`,
    message: { error: 'Too many login attempts. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
  })
}

export function registerRateLimiter() {
  return rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 20,
    message: { error: 'Too many accounts created from this network. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
  })
}

const MAX_LOGIN_FAILURES = 5
const LOCKOUT_MS = 30 * 60 * 1000

interface FailureRecord {
  count: number
  lockedUntil: number
}

// In-memory lockout state — sufficient for a single API instance.
const loginFailures = new Map<string, FailureRecord>()

function failureKey(email: string): string {
  return email.trim().toLowerCase()
}

export function assertNotLocked(email: string): void {
  const record = loginFailures.get(failureKey(email))
  if (!record) return
  if (record.lockedUntil > Date.now()) {
    const minutes = Math.ceil((record.lockedUntil - Date.now()) / 60000)
    throw new AppError(429, `Too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`)
  }
}

export function recordLoginFailure(email: string): void {
  const key = failureKey(email)
  const record = loginFailures.get(key) ?? { count: 0, lockedUntil: 0 }
  record.count += 1
  if (record.count >= MAX_LOGIN_FAILURES) {
    record.lockedUntil = Date.now() + LOCKOUT_MS
    record.count = 0
  }
  loginFailures.set(key, record)
}

export function resetLoginFailures(email: string): void {
  loginFailures.delete(failureKey(email))
}

export function globalRateLimiter() {
  return rateLimit({
    windowMs: 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
  })
}