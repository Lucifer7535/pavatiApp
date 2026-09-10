import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import type { Express } from 'express'
import { createApp } from '../index.js'
import { config } from '../config/index.js'

const base = config.publicBaseUrl.replace(/\/$/, '')

const dbAvailable = await (async () => {
  try {
    const { prisma } = await import('../lib/prisma.js')
    await prisma.$queryRaw`SELECT 1`
    return true
  } catch {
    return false
  }
})()

describe.skipIf(!dbAvailable)('bot prerendering', () => {
  let app: Express

  const trustId = 'prerender-test-trust'
  const campaignSlug = `prerender-test-campaign-${Date.now()}`

  beforeAll(async () => {
    process.env.NODE_ENV = 'test'
    app = createApp()
    const { prisma } = await import('../lib/prisma.js')
    await prisma.trust.create({
      data: {
        id: trustId,
        name: 'Prerender Test Trust',
        uniqueCode: 'PRERENDERTEST',
        joinCode: `JOIN-${Date.now()}`,
        description: 'A trust used to verify bot prerendering.',
        city: 'Pune',
        state: 'Maharashtra',
      },
    })
  })

  afterAll(async () => {
    const { prisma } = await import('../lib/prisma.js')
    await prisma.trust.delete({ where: { id: trustId } }).catch(() => {})
    await prisma.$disconnect()
  })
  it('serves a prerendered header + canonical + JSON-LD to social bots for /trust/:id', async () => {
    const res = await request(app).get(`/trust/${trustId}`).set('User-Agent', 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)')
    expect(res.status).toBe(200)
    expect(res.headers['x-prerender']).toBe('1')
    expect(res.headers['content-type']).toContain('text/html')
    expect(res.text).toContain('<title>Prerender Test Trust — Donate &amp; Join</title>')
    expect(res.text).toContain('property="og:title" content="Prerender Test Trust — Donate &amp; Join"')
    expect(res.text).toContain(`rel="canonical" href="${base}/trust/${trustId}"`)
    expect(res.text).toContain(`property="og:url" content="${base}/trust/${trustId}"`)
    expect(res.text).toContain('"@type":"NGO"')
    expect(res.text).toContain('A trust used to verify bot prerendering.')
  })

  it('assigns a stable fingerprint with caches for repeat visits', async () => {
    const ua = 'Twitterbot/1.0'
    const first = await request(app).get(`/trust/${trustId}`).set('User-Agent', ua)
    const second = await request(app).get(`/trust/${trustId}`).set('User-Agent', ua)
    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
    expect(second.headers['x-prerender']).toBe('1')
    expect(second.text).toBe(first.text)
  })

  it('does not prerender for search-engine crawlers', async () => {
    const res = await request(app).get(`/trust/${trustId}`).set('User-Agent', 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)')
    expect(res.status).toBe(404)
    expect(res.headers['x-prerender']).toBeUndefined()
    expect(res.body.error).toBe('Route not found')
  })

  it('does not prerender unknown trust ids', async () => {
    const res = await request(app).get('/trust/00000000-0000-0000-0000-000000000000').set('User-Agent', 'whatsapp')
    expect(res.status).toBe(404)
    expect(res.headers['x-prerender']).toBeUndefined()
  })

  it('falls through for non-public paths', async () => {
    const res = await request(app).get('/app/dashboard').set('User-Agent', 'facebookexternalhit/1.1')
    expect(res.status).toBe(404)
    expect(res.headers['x-prerender']).toBeUndefined()
  })

  it('serves campaign meta for /donate/:slug', async () => {
    const { prisma } = await import('../lib/prisma.js')
    await prisma.paymentCampaign.create({
      data: {
        trustId,
        name: 'Prerender Test Campaign',
        slug: campaignSlug,
        description: 'Donate to the fair and get a festive p\u0101vati.',
      },
    })
    const res = await request(app).get(`/donate/${campaignSlug}`).set('User-Agent', 'TelegramBot (like TwitterBot)')
    expect(res.status).toBe(200)
    expect(res.text).toContain('<title>Prerender Test Campaign — Donate to Prerender Test Trust</title>')
    expect(res.text).toContain(`rel="canonical" href="${base}/donate/${campaignSlug}"`)
    expect(res.text).toContain(`property="og:url" content="${base}/donate/${campaignSlug}"`)
    expect(res.text).toContain('Donate to the fair and get a festive p')
    await prisma.paymentCampaign.delete({ where: { slug: campaignSlug } })
  })

  it('does not prerender inactive campaigns', async () => {
    const { prisma } = await import('../lib/prisma.js')
    await prisma.paymentCampaign.createMany({
      data: [
        { trustId, name: 'Inactive Campaign', slug: `${campaignSlug}-inactive`, description: 'Hidden', active: false },
        { trustId, name: 'Active Campaign', slug: `${campaignSlug}-active`, description: 'Shown', active: true },
      ],
    })
    const inactiveRes = await request(app).get(`/donate/${campaignSlug}-inactive`).set('User-Agent', 'facebookexternalhit/1.1')
    expect(inactiveRes.status).toBe(404)
    const activeRes = await request(app).get(`/donate/${campaignSlug}-active`).set('User-Agent', 'facebookexternalhit/1.1')
    expect(activeRes.status).toBe(200)
    expect(activeRes.text).toContain('Active Campaign')
    await prisma.paymentCampaign.deleteMany({ where: { trustId } })
  })
})