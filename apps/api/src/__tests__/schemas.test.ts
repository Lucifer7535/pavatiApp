import { describe, expect, it } from 'vitest'
import {
  createCampaignSchema,
  createDonationSchema,
  createTemplateSchema,
  createTrustSchema,
  joinByCodeSchema,
  registerSchema,
  selfDonationSchema,
  updateTrustSchema,
} from '@pavati/shared'

describe('registerSchema', () => {
  const base = { name: 'Test User', password: 'secret123' }

  it('accepts normal emails, normalising case and whitespace', () => {
    expect(registerSchema.safeParse({ ...base, email: 'user@example.com' }).success).toBe(true)
    const r = registerSchema.safeParse({ ...base, email: '  USER@Example.co.in  ' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.email).toBe('user@example.co.in')
  })

  it('rejects malformed emails', () => {
    for (const bad of ['plainaddress', 'a@b', 'a@b.c', 'a..b@test.com', 'a@b..com', '@test.com']) {
      expect(registerSchema.safeParse({ ...base, email: bad }).success).toBe(false)
    }
  })

  it('rejects disposable email domains case-insensitively', () => {
    expect(registerSchema.safeParse({ ...base, email: 'x@mailinator.com' }).success).toBe(false)
    expect(registerSchema.safeParse({ ...base, email: 'x@Mailinator.COM' }).success).toBe(false)
    expect(registerSchema.safeParse({ ...base, email: 'x@yopmail.fr' }).success).toBe(false)
  })
})

describe('joinByCodeSchema', () => {
  it('accepts an optional code', () => {
    expect(joinByCodeSchema.safeParse({}).success).toBe(true)
  })
  it('still validates a provided code shape', () => {
    expect(joinByCodeSchema.safeParse({ code: 'ABC123' }).success).toBe(true)
    expect(joinByCodeSchema.safeParse({ code: '' }).success).toBe(false)
  })
})

describe('selfDonationSchema', () => {
  const base = { amount: 500, category: 'DAAN' }
  it('accepts a minimal self donation', () => {
    const r = selfDonationSchema.safeParse(base)
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.privacy).toBe('PRIVATE')
  })
  it('rejects zero or negative amounts', () => {
    expect(selfDonationSchema.safeParse({ ...base, amount: 0 }).success).toBe(false)
    expect(selfDonationSchema.safeParse({ ...base, amount: -100 }).success).toBe(false)
  })
  it('rejects amounts above the cap', () => {
    expect(selfDonationSchema.safeParse({ ...base, amount: 10_000_001 }).success).toBe(false)
  })
  it('requires a valid proof URL when provided', () => {
    expect(selfDonationSchema.safeParse({ ...base, proofUrl: 'https://example.com/proof.png' }).success).toBe(true)
    expect(selfDonationSchema.safeParse({ ...base, proofUrl: 'not-a-url' }).success).toBe(false)
  })
})

describe('createDonationSchema', () => {
  const base = {
    trustId: '096dd518-28fe-4b70-8ea9-2a6a0aea0252',
    donorName: 'Rajesh Patil',
    amount: 501,
    category: 'Ganpati Donation',
    paymentMode: 'CASH',
  }

  it('accepts a valid donation', () => {
    expect(createDonationSchema.parse(base)).toMatchObject({ privacy: 'PRIVATE' })
  })

  it('rejects a missing trustId', () => {
    const { trustId, ...rest } = base
    expect(() => createDonationSchema.parse(rest)).toThrow(/trustId/)
  })

  it('rejects non-positive amounts', () => {
    expect(() => createDonationSchema.parse({ ...base, amount: 0 })).toThrow()
    expect(() => createDonationSchema.parse({ ...base, amount: -5 })).toThrow()
  })

  it('rejects an invalid 10-digit phone', () => {
    expect(() => createDonationSchema.parse({ ...base, phone: '12345' })).toThrow()
    expect(() => createDonationSchema.parse({ ...base, phone: '9876543210' })).not.toThrow()
  })

  it('accepts splits that sum to the amount', () => {
    expect(
      createDonationSchema.parse({
        ...base,
        amount: 1000,
        paymentMode: undefined,
        splits: [
          { paymentMode: 'CASH', amount: 500 },
          { paymentMode: 'UPI', amount: 500, transactionRef: '123456789012' },
        ],
      }),
    ).toMatchObject({ amount: 1000 })
  })

  it('rejects splits whose sum differs from the amount', () => {
    expect(() =>
      createDonationSchema.parse({
        ...base,
        amount: 1000,
        paymentMode: undefined,
        splits: [
          { paymentMode: 'CASH', amount: 400 },
          { paymentMode: 'UPI', amount: 500 },
        ],
      }),
    ).toThrow(/add up/)
  })

  it('rejects awaitingPayment with only cash splits', () => {
    expect(() =>
      createDonationSchema.parse({
        ...base,
        splits: [{ paymentMode: 'CASH', amount: 501 }],
        awaitingPayment: true,
      }),
    ).toThrow(/Cash payments/)
  })

  it('allows awaitingPayment when an online split exists', () => {
    expect(() =>
      createDonationSchema.parse({
        ...base,
        splits: [
          { paymentMode: 'CASH', amount: 1 },
          { paymentMode: 'UPI', amount: 500 },
        ],
        awaitingPayment: true,
      }),
    ).not.toThrow()
  })
})

describe('createTemplateSchema', () => {
  const field = {
    key: 'donorName',
    label: 'Donor Name',
    x: 4,
    y: 42,
    width: 60,
    height: 8,
    fontSize: 19,
    fontFamily: 'Mukta-Bold',
    color: '#4a1f0c',
    align: 'left',
    bold: true,
    visible: true,
  }

  it('accepts a template with fields', () => {
    const out = createTemplateSchema.parse({ name: 'Ganeshotsav', fieldConfigs: [field] })
    expect(out.pageSize).toBe('A5')
    expect(out.fieldConfigs).toHaveLength(1)
  })

  it('rejects coordinates outside 0-100', () => {
    expect(() => createTemplateSchema.parse({ name: 'Bad', fieldConfigs: [{ ...field, x: 150 }] })).toThrow()
  })

  it('rejects a short name', () => {
    expect(() => createTemplateSchema.parse({ name: 'A' })).toThrow()
  })
})

describe('createTrustSchema & updateTrustSchema', () => {
  const base = {
    name: 'Shree Ganesh Mandal',
    festivalTypes: ['Ganesh Chaturthi'],
    joinMode: 'OPEN',
  }

  it('accepts custom festivals not in the predefined list', () => {
    const out = createTrustSchema.parse({ ...base, festivalTypes: ['Gudi Padwa', 'My Local Utsav 2026'] })
    expect(out.festivalTypes).toEqual(['Gudi Padwa', 'My Local Utsav 2026'])
  })

  it('rejects an empty festival list', () => {
    expect(() => createTrustSchema.parse({ ...base, festivalTypes: [] })).toThrow(/at least one festival/)
  })

  it('rejects blank festival names', () => {
    expect(() => createTrustSchema.parse({ ...base, festivalTypes: ['   '] })).toThrow(/Festival name is required/)
  })

  it('rejects more than 20 festivals', () => {
    const many = Array.from({ length: 21 }, (_, i) => `Festival ${i}`)
    expect(() => createTrustSchema.parse({ ...base, festivalTypes: many })).toThrow()
  })

  it('trims whitespace around festival names', () => {
    const out = createTrustSchema.parse({ ...base, festivalTypes: ['  Gudi Padwa  '] })
    expect(out.festivalTypes).toEqual(['Gudi Padwa'])
  })

  it('updateTrustSchema accepts a partial update with a custom festival', () => {
    const out = updateTrustSchema.parse({ festivalTypes: ['Raksha Bandhan'] })
    expect(out.festivalTypes).toEqual(['Raksha Bandhan'])
  })
})

describe('custom categories across donation & campaign schemas', () => {
  const uuid = '096dd518-28fe-4b70-8ea9-2a6a0aea0252'

  it('createDonationSchema accepts a custom festival as category', () => {
    const out = createDonationSchema.parse({
      trustId: uuid,
      donorName: 'Rajesh Patil',
      amount: 501,
      category: 'Gudi Padwa',
      paymentMode: 'CASH',
    })
    expect(out.category).toBe('Gudi Padwa')
  })

  it('createCampaignSchema accepts a custom festival as category', () => {
    const out = createCampaignSchema.parse({ name: 'Gudi Padwa Fund', category: 'Gudi Padwa' })
    expect(out.category).toBe('Gudi Padwa')
  })

  it('rejects a blank category', () => {
    expect(() => createDonationSchema.parse({ trustId: uuid, donorName: 'R', amount: 10, category: '   ', paymentMode: 'CASH' })).toThrow()
  })
})

describe('registerSchema', () => {
  it('requires a strong enough password', () => {
    expect(() => registerSchema.parse({ name: 'Test User', email: 't@test.in', password: '123' })).toThrow()
    expect(() => registerSchema.parse({ name: 'Test User', email: 't@test.in', password: '123456' })).not.toThrow()
  })
})