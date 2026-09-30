import { describe, expect, it } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { createApp } from '../index.js'
import { config } from '../config/index.js'
import '../config/index.js'

/**
 * The developer console previously returned financial totals and a user PII list to the
 * browser. Those are now computed and returned nowhere, so this asserts on the serialised
 * payload rather than on any single field: if any code path reintroduces an amount or a
 * user identity under a new key, the key scan fails.
 */

const dbAvailable = await (async () => {
  try {
    const { prisma } = await import('../lib/prisma.js')
    await prisma.$queryRaw`SELECT 1`
    return true
  } catch {
    return false
  }
})()

function collectKeys(value: unknown, into = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const v of value) collectKeys(v, into)
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      into.add(k)
      collectKeys(v, into)
    }
  }
  return into
}

/**
 * Collapses casing and underscore differences so a banned name cannot be evaded by
 * renaming it: "totalAmount", "total_amount" and "TOTAL_AMOUNT" all normalise alike.
 */
function normalizeKey(key: string): string {
  return key.replace(/_/g, '').toLowerCase()
}

function bannedKeysPresent(body: unknown, banned: string[]): string[] {
  const keys = new Set([...collectKeys(body)].map(normalizeKey))
  return banned.map(normalizeKey).filter((b) => keys.has(b))
}

describe('developer console analytics payload', () => {
  const app = createApp()
  const devToken = () => jwt.sign({ sub: 'developer', type: 'developer' }, config.jwtSecret, { expiresIn: '24h' })

  it.skipIf(!dbAvailable)('omits donation amounts and recent-user PII', async () => {
    const res = await request(app)
      .get('/api/v1/dev/stats')
      .set('Authorization', `Bearer ${devToken()}`)

    expect(res.status).toBe(200)

    // Case/underscore-insensitive so "recentUsers" cannot return as "recent_users".
    expect(bannedKeysPresent(res.body, ['totalDonationAmount', 'totalAmount', 'total_amount', 'recentUsers', 'recentUser', '_sum'])).toEqual([])

    // Raw body scan is the backstop for values under an unfamiliar key name.
    const raw = JSON.stringify(res.body)
    expect(raw).not.toMatch(/"amount"|"total_amount"/)
    // PII field names, in case they reappear under a name the key scan does not list.
    expect(raw).not.toMatch(/"email"|"phone"|"fullName"|"recent_users"/i)
  })

  it.skipIf(!dbAvailable)('still returns the non-PII aggregate counts', async () => {
    const res = await request(app)
      .get('/api/v1/dev/stats')
      .set('Authorization', `Bearer ${devToken()}`)

    expect(res.status).toBe(200)
    expect(res.body.data.summary).toHaveProperty('totalDonations')
    expect(res.body.data.summary).toHaveProperty('totalUsers')
    expect(res.body.data.donationByStatus).toBeInstanceOf(Array)
    expect(res.body.data.trustBreakdown).toBeInstanceOf(Array)

    for (const row of res.body.data.trustBreakdown ?? []) {
      expect(row).toHaveProperty('memberCount')
      expect(row).toHaveProperty('donationCount')
      expect(row).not.toHaveProperty('totalAmount')
    }
  })
})

describe('developer console health metrics', () => {
  const app = createApp()
  const devToken = () => jwt.sign({ sub: 'developer', type: 'developer' }, config.jwtSecret, { expiresIn: '24h' })

  it.skipIf(!dbAvailable)('reports runtime metrics without leaking credentials', async () => {
    const res = await request(app)
      .get('/api/v1/dev/health')
      .set('Authorization', `Bearer ${devToken()}`)

    expect(res.status).toBe(200)

    const h = res.body.data
    expect(h.uptimeSeconds).toBeGreaterThan(0)
    expect(h.uptime).toMatch(/^\d+[dhm]/)
    expect(h.memoryMb.rss).toBeGreaterThan(0)
    expect(h.db.ok).toBe(true)
    expect(typeof h.eventLoopDelayMs).toBe('number')
    expect(typeof h.cpuPercent).toBe('number')
    expect(h.host.node).toBe(process.version)

    // Same key scan as the analytics payload: nothing secret may ride along.
    expect(bannedKeysPresent(res.body, ['jwtSecret', 'refreshSecret', 'devPassword', 'devEmail', 'databaseUrl', 'smtpPassword', 'r2SecretAccessKey', 'stripeSecretKey'])).toEqual([])
  })

  it.skipIf(!dbAvailable)('formats uptime with days only once there are days', async () => {
    const { formatUptime } = await import('../lib/health.js')
    expect(formatUptime(59)).toBe('0m 59s')
    expect(formatUptime(3661)).toBe('1h 1m')
    expect(formatUptime(90061)).toBe('1d 1h 1m')
  })

  it('requires a bearer token for the health endpoint', async () => {
    const res = await request(app).get('/api/v1/dev/health')
    expect(res.status).toBe(401)
  })

  it('answers an expired developer token with 401 on the health endpoint', async () => {
    const expired = jwt.sign({ sub: 'developer', type: 'developer' }, config.jwtSecret, { expiresIn: '-1s' })
    const res = await request(app).get('/api/v1/dev/health').set('Authorization', `Bearer ${expired}`)
    expect(res.status).toBe(401)
  })

  it('keeps the platform health probe free of runtime metrics', async () => {
    // Heroku polls /health for dyno status. Runtime metrics and a database round-trip
    // would slow that probe, so they must stay on the developer route only.
    const res = await request(app).get('/health')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ok: true, service: 'pavati-api', time: expect.any(String) })
  })
})

describe('developer console session expiry', () => {
  const app = createApp()

  it('answers an expired developer token with 401 so the client can re-login', async () => {
    const expired = jwt.sign({ sub: 'developer', type: 'developer' }, config.jwtSecret, { expiresIn: '-1s' })
    const res = await request(app).get('/api/v1/dev/stats').set('Authorization', `Bearer ${expired}`)
    expect(res.status).toBe(401)
  })

  it.skipIf(!dbAvailable)('answers a tampered developer token with 401', async () => {
    const foreign = jwt.sign({ sub: 'developer', type: 'developer' }, 'a-completely-different-signing-secret')
    const res = await request(app).get('/api/v1/dev/stats').set('Authorization', `Bearer ${foreign}`)
    expect(res.status).toBe(401)
  })

  it('requires a bearer token for the analytics endpoint', async () => {
    const res = await request(app).get('/api/v1/dev/stats')
    expect(res.status).toBe(401)
  })
})
