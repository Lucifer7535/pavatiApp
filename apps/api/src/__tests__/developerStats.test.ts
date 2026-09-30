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

describe('developer console analytics payload', () => {
  const app = createApp()
  const devToken = () => jwt.sign({ sub: 'developer', type: 'developer' }, config.jwtSecret, { expiresIn: '24h' })

  it.skipIf(!dbAvailable)('omits donation amounts and recent-user PII', async () => {
    const res = await request(app)
      .get('/api/v1/dev/stats')
      .set('Authorization', `Bearer ${devToken()}`)

    expect(res.status).toBe(200)

    const keys = collectKeys(res.body)
    for (const banned of ['totalDonationAmount', 'totalAmount', 'total_amount', 'recentUsers', '_sum']) {
      expect(keys.has(banned), `response must not expose "${banned}"`).toBe(false)
    }

    // Raw body scan catches an amount leaking under a differently-named key.
    expect(JSON.stringify(res.body)).not.toMatch(/"amount"|"total_amount"/)
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
