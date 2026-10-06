import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import type { Express } from 'express'
import { createApp } from '../index.js'
import { signAccessToken } from '../lib/jwt.js'
import { currentFYWindow, nextFYWindow } from '../lib/financialYear.js'

const dbAvailable = await (async () => {
  try {
    const { prisma } = await import('../lib/prisma.js')
    await prisma.$queryRaw`SELECT 1`
    return true
  } catch {
    return false
  }
})()

describe.skipIf(!dbAvailable)('donation receipt + financial-year close guards', () => {
  let app: Express
  const trustId = 'd3c4f5a6-b7c8-4d9e-8f0a-1b2c3d4e5f60'
  const suffix = Date.now()
  let userId: string
  let token: string

  beforeAll(async () => {
    process.env.NODE_ENV = 'test'
    app = createApp()
    const { prisma } = await import('../lib/prisma.js')
    const user = await prisma.user.create({
      data: { name: 'FY Guard Tester', email: `fy-guard-${suffix}@test.in` },
    })
    userId = user.id
    await prisma.trust.create({
      data: {
        id: trustId,
        name: 'FY Guard Trust',
        uniqueCode: `FYGUARD${suffix}`,
        joinCode: `JOIN-FYG-${suffix}`,
        festivalTypes: [],
        description: 'Used by donation receipt + financial-year close guard tests.',
      },
    })
    await prisma.trustMember.create({
      data: { trustId, userId, role: 'PRIMARY_ADMIN' },
    })
    token = signAccessToken({ id: user.id, tokenVersion: user.tokenVersion })
  })

  afterAll(async () => {
    const { prisma } = await import('../lib/prisma.js')
    await prisma.trust.delete({ where: { id: trustId } }).catch(() => {})
    if (userId) await prisma.user.delete({ where: { id: userId } }).catch(() => {})
    await prisma.$disconnect()
  })

  it('rejects a SUCCEEDED donation without an active template and persists nothing', async () => {
    const before = await (await import('../lib/prisma.js')).prisma.donation.count({ where: { trustId } })
    const res = await request(app)
      .post(`/api/v1/trusts/${trustId}/donations`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        trustId,
        donorName: 'No Template Donor',
        amount: 1000,
        category: 'General Donation',
        paymentMode: 'CASH',
      })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/receipt template configured/i)
    const after = await (await import('../lib/prisma.js')).prisma.donation.count({ where: { trustId } })
    const splits = await (await import('../lib/prisma.js')).prisma.donationSplit.count({ where: { donation: { trustId } } })
    expect(after).toBe(before)
    expect(splits).toBe(0)
  })

  it('still records an awaitingPayment donation without a template (receipt deferred)', async () => {
    const res = await request(app)
      .post(`/api/v1/trusts/${trustId}/donations`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        trustId,
        donorName: 'Awaiting Donor',
        amount: 2000,
        category: 'General Donation',
        awaitingPayment: true,
        splits: [{ paymentMode: 'UPI', amount: 2000 }],
      })
    expect(res.status).toBe(201)
    expect(res.body.data.donation.status).toBe('PENDING')
    expect(res.body.data.receipt).toBeNull()
  })

  it('advances the current financial year immediately on close and across APIs', async () => {
    const noConfig = {}
    const closedToday = currentFYWindow(noConfig)
    const expectedNext = nextFYWindow(noConfig, closedToday)

    const close = await request(app)
      .post(`/api/v1/trusts/${trustId}/financial-years/close`)
      .set('Authorization', `Bearer ${token}`)
    expect(close.status).toBe(201)
    expect(close.body.data.closed.year).toBe(closedToday.label)
    expect(close.body.data.current.label).toBe(expectedNext.label)

    const list = await request(app)
      .get(`/api/v1/trusts/${trustId}/financial-years`)
      .set('Authorization', `Bearer ${token}`)
    expect(list.status).toBe(200)
    expect(list.body.data.current.label).toBe(expectedNext.label)
    expect(list.body.data.closed.map((c: { year: string }) => c.year)).toContain(closedToday.label)
    expect(list.body.data.canClose).toBe(true)

    const dash = await request(app)
      .get(`/api/v1/trusts/${trustId}/dashboard`)
      .set('Authorization', `Bearer ${token}`)
    expect(dash.status).toBe(200)
    expect(dash.body.data.financialYear).toBe(expectedNext.label)

    const report = await request(app)
      .get(`/api/v1/trusts/${trustId}/reports/summary`)
      .set('Authorization', `Bearer ${token}`)
    expect(report.status).toBe(200)
    expect(report.body.data.financialYear).toBe(expectedNext.label)
  })
})