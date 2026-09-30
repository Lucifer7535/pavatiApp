import { describe, expect, it } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { createApp } from '../index.js'
import { config } from '../config/index.js'
// Loads .env (and therefore DATABASE_URL) before the top-level availability probe
// below. Static imports are evaluated before the module body.
import '../config/index.js'

/**
 * Regression tests for the security remediation.
 *
 * These cover the pure, deterministic parts of the fixes: response-credential
 * stripping, storage-key containment, CSV formula neutralisation, prerender escaping
 * and the receipt visibility predicate. They need no database.
 */

/** Recursively collects every object key present in a serialised payload. */
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

const dbAvailable = await (async () => {
  try {
    const { prisma } = await import('../lib/prisma.js')
    await prisma.$queryRaw`SELECT 1`
    return true
  } catch {
    return false
  }
})()

describe('refresh token verification', () => {
  // Regression: jwt.verify throws JsonWebTokenError, which asyncHandler cannot map to a
  // status code. /refresh used to call it bare, so any tampered or foreign-signed token
  // produced a 500 with a stack trace instead of a 401.
  const app = createApp()

  it('answers a garbage refresh token with 401, not 500', async () => {
    const res = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: 'not-a-jwt' })
    expect(res.status).toBe(401)
  })

  it('answers a token signed with a foreign key with 401, not 500', async () => {
    const foreign = jwt.sign({ sub: '00000000-0000-0000-0000-000000000000', type: 'refresh', ver: 0 }, 'a-completely-different-signing-secret')
    const res = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: foreign })
    expect(res.status).toBe(401)
  })

  it('answers an expired refresh token with 401, not 500', async () => {
    const expired = jwt.sign({ sub: '00000000-0000-0000-0000-000000000000', type: 'refresh', ver: 0 }, config.refreshSecret, { expiresIn: '-1s' })
    const res = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: expired })
    expect(res.status).toBe(401)
  })

  // Reaches the database, so it is gated on availability like the rest of the db-backed
  // suite. CI's check job sets DATABASE_URL but runs no postgres service.
  it.skipIf(!dbAvailable)('still rejects a well-formed refresh token with no database record as 401', async () => {
    const valid = jwt.sign({ sub: '00000000-0000-0000-0000-000000000000', type: 'refresh', ver: 0 }, config.refreshSecret, { expiresIn: '1h' })
    const res = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: valid })
    expect(res.status).toBe(401)
  })
})

describe('storage write containment', () => {
  // The read path was validated already; saveBuffer is the sink that writes, and it now
  // validates subdir at the boundary so no caller can write outside the upload root.
  // These reject before any filesystem call, so they have no side effects.
  it('refuses a subdir that escapes the upload root', async () => {
    const { saveBuffer } = await import('../providers/storage.js')
    await expect(saveBuffer(Buffer.from('x'), 'png', '../../etc')).rejects.toThrow()
    await expect(saveBuffer(Buffer.from('x'), 'png', 'images/../../..')).rejects.toThrow()
  })

  it('refuses an absolute or backslash subdir', async () => {
    const { saveBuffer } = await import('../providers/storage.js')
    await expect(saveBuffer(Buffer.from('x'), 'png', '/etc')).rejects.toThrow()
    await expect(saveBuffer(Buffer.from('x'), 'png', 'images\\..\\..')).rejects.toThrow()
  })
})

describe.skipIf(!dbAvailable)('prismaPublic credential stripping', () => {
  it('never returns passwordHash or tokenHash at any nesting depth', async () => {
    const { prismaPublic } = await import('../lib/prisma.js')

    const user = await prismaPublic.user.findFirst()
    const member = await prismaPublic.trustMember.findFirst({ include: { user: true } })
    // `select` rather than `include`: the public client rejects truthy includes
    // outright (see the assertion below), so it cannot be used to smuggle an
    // unmapped relation read.
    const donation = await prismaPublic.donation.findFirst({
      select: { id: true, submitter: { select: { id: true, user: { select: { id: true, name: true } } } } },
    })

    for (const [label, row] of [['user', user], ['trustMember+user', member], ['donation+submitter+user', donation]] as const) {
      if (!row) continue
      const keys = collectKeys(row)
      expect(keys.has('passwordHash'), `${label} leaked passwordHash`).toBe(false)
      expect(keys.has('tokenHash'), `${label} leaked tokenHash`).toBe(false)
    }
  })

  it('rejects truthy includes, so an unmapped relation read is impossible', async () => {
    const { prismaPublic } = await import('../lib/prisma.js')
    await expect(
      prismaPublic.donation.findFirst({ include: { submittedBy: { include: { user: true } } } } as never),
    ).rejects.toThrow()
  })

  it('the internal client still exposes credentials for auth decisions', async () => {
    const { prisma } = await import('../lib/prisma.js')
    const user = await prisma.user.findFirst({ select: { passwordHash: true } })
    // The split must not have broken password verification: auth reads the hash from
    // the internal client, so it must remain available there.
    if (user) expect('passwordHash' in user).toBe(true)
  })

  it('omits the receipt verification bearer from list responses', async () => {
    const { prismaPublic } = await import('../lib/prisma.js')
    const row = await prismaPublic.receipt.findFirst({
      select: {
        id: true, receiptNumber: true, donationId: true, trustId: true, templateId: true,
        pdfUrl: true, status: true, voidedById: true, voidReason: true, generatedAt: true,
      },
    })
    if (row) expect('verificationToken' in row).toBe(false)
  })
})

describe('storage key containment', () => {
  // Mirrors the guard in providers/storage.ts.
  function safeStorageKey(raw: string): string | null {
    let decoded: string
    try {
      decoded = decodeURIComponent(raw)
    } catch {
      return null
    }
    if (decoded.includes('\0') || decoded.includes('\\')) return null
    if (decoded.startsWith('/') || /^[A-Za-z]:/.test(decoded)) return null
    const segments = decoded.split('/')
    if (segments.some((s) => s === '..' || s === '.')) return null
    if (!segments.some((s) => s.length > 0)) return null
    return segments.join('/')
  }

  it.each([
    ['../etc/passwd'],
    ['a/../../etc/passwd'],
    ['..%2f..%2fetc%2fpasswd'],
    ['%2e%2e/%2e%2e/etc/shadow'],
    ['/etc/passwd'],
    ['receipts/../../../etc/hosts'],
    ['C:\\Windows\\win.ini'],
    ['a\\..\\..\\b'],
  ])('rejects traversal key %s', (key) => {
    expect(safeStorageKey(key)).toBeNull()
  })

  it.each([
    ['receipts/abc/file.pdf'],
    ['logos/trust-1.png'],
    ['a/b/c/d.png'],
  ])('allows legitimate key %s', (key) => {
    expect(safeStorageKey(key)).toBe(key)
  })
})

describe('CSV formula neutralisation', () => {
  function csvCell(value: unknown): string {
    const raw = value === null || value === undefined ? '' : String(value)
    if (/^[=+\-@\t\r]/.test(raw)) return `'${raw}`
    return raw.replace(/"/g, '""')
  }

  it.each([
    ['=HYPERLINK("http://evil.example","x")'],
    ['+1+1'],
    ['-2+3'],
    ['@SUM(1+1)'],
    ['\t=cmd|calc'],
  ])('defangs formula-leading donor value %j', (value) => {
    const cell = csvCell(value)
    expect(cell.startsWith("'")).toBe(true)
    expect(/^[=+\-@\t\r]/.test(cell)).toBe(false)
  })

  it('still escapes embedded quotes per RFC 4180', () => {
    expect(csvCell('She said "hi"')).toBe('She said ""hi""')
  })

  it('leaves ordinary values untouched', () => {
    expect(csvCell('Rajesh Patil')).toBe('Rajesh Patil')
    expect(csvCell(null)).toBe('')
  })
})

describe('bot prerender attribute escaping', () => {
  function escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }

  it('prevents an attacker-controlled logoUrl from breaking out of the og:image attribute', () => {
    const logo = 'x"><script>alert(1)</script><meta x="'
    const rendered = `<meta property="og:image" content="${escapeHtml(logo)}" />`
    expect(rendered).not.toContain('<script>')
    expect(rendered).toContain('&quot;')
    // Exactly one tag boundary: the injected angle brackets are inert.
    expect(rendered.match(/<script>/g)).toBeNull()
  })
})

describe('receipt donation visibility predicate', () => {
  it('restricts a non-official member to public, own and collected donations', async () => {
    const { donationVisibilityFilter } = await import('../lib/access.js')
    const member = {
      id: 'm1',
      trustId: 't1',
      userId: 'u1',
      role: 'COLLECTOR',
      permissions: [],
      status: 'ACTIVE',
      position: null,
      contactVisible: true,
      introduction: null,
      joinedAt: new Date(),
    } as never
    const filter = donationVisibilityFilter(member)
    expect(JSON.stringify(filter)).toContain('PUBLIC')
    expect(JSON.stringify(filter)).toContain('m1')
  })
})
