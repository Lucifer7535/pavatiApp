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

/**
 * Failed logins for one source host, regardless of which account is targeted.
 *
 * This is the axis that keeps password guessing bounded once the per-account lockout
 * is scoped to a client (see `failureKey`). Without it, an attacker could rotate
 * source addresses and try one guess per address against the same victim forever.
 */
const MAX_IP_LOGIN_FAILURES = 25
const IP_LOCKOUT_MS = 15 * 60 * 1000

interface FailureRecord {
  count: number
  lockedUntil: number
}

// In-memory lockout state — sufficient for a single API instance.
const loginFailures = new Map<string, FailureRecord>()
const ipFailures = new Map<string, FailureRecord>()

function failureKey(ip: string, email: string): string {
  return `${ip.trim().toLowerCase()}|${email.trim().toLowerCase()}`
}

function assertUnlocked(store: Map<string, FailureRecord>, key: string): void {
  const record = store.get(key)
  if (!record) return
  if (record.lockedUntil > Date.now()) {
    const minutes = Math.ceil((record.lockedUntil - Date.now()) / 60000)
    throw new AppError(429, `Too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`)
  }
}

function registerFailure(store: Map<string, FailureRecord>, key: string, max: number, lockoutMs: number): void {
  const record = store.get(key) ?? { count: 0, lockedUntil: 0 }
  record.count += 1
  if (record.count >= max) {
    record.lockedUntil = Date.now() + lockoutMs
    record.count = 0
  }
  store.set(key, record)
}

/**
 * Throws 429 when either the (ip, account) pair or the source host is locked out.
 *
 * The account axis is deliberately *not* global. Keying lockout on the email address
 * alone meant that anyone who knew or guessed a victim's address could permanently deny
 * that person password login from anywhere, without ever knowing the password — the
 * counter only needed five wrong guesses per account. Scoping it to the source host
 * keeps the real brute-force defence while removing the denial of service.
 */
export function assertNotLocked(ip: string, email: string): void {
  assertUnlocked(loginFailures, failureKey(ip, email))
  assertUnlocked(ipFailures, ip.trim().toLowerCase())
}

export function recordLoginFailure(ip: string, email: string): void {
  registerFailure(loginFailures, failureKey(ip, email), MAX_LOGIN_FAILURES, LOCKOUT_MS)
  registerFailure(ipFailures, ip.trim().toLowerCase(), MAX_IP_LOGIN_FAILURES, IP_LOCKOUT_MS)
}

export function resetLoginFailures(ip: string, email: string): void {
  loginFailures.delete(failureKey(ip, email))
}

export function clientIp(req: Request): string {
  return req.ip ?? req.socket?.remoteAddress ?? 'unknown'
}

export function globalRateLimiter() {
  return rateLimit({
    windowMs: 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
  })
}