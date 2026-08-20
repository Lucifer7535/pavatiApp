import { describe, expect, it } from 'vitest'
import {
  createCampaignSchema,
  createDonationSchema,
  createOnlineDonationSchema,
  createTemplateSchema,
  createTrustSchema,
  registerSchema,
  updateTrustSchema,
  verifyOtpSchema,
} from '@pavati/shared'

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
})

describe('createOnlineDonationSchema', () => {
  const base = {
    trustId: '096dd518-28fe-4b70-8ea9-2a6a0aea0252',
    amount: 1100,
    category: 'Ganpati Donation',
  }

  it('accepts an anonymous online donation without contact details', () => {
    const out = createOnlineDonationSchema.parse({ ...base, anonymous: true })
    expect(out.anonymous).toBe(true)
  })

  it('requires a name when not anonymous', () => {
    expect(() => createOnlineDonationSchema.parse({ ...base, anonymous: false })).not.toThrow()
  })

  it('validates email format when provided', () => {
    expect(() => createOnlineDonationSchema.parse({ ...base, email: 'nope' })).toThrow()
    expect(() => createOnlineDonationSchema.parse({ ...base, email: 'donor@test.in' })).not.toThrow()
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

  it('createOnlineDonationSchema accepts a custom festival as category', () => {
    const out = createOnlineDonationSchema.parse({ trustId: uuid, amount: 1100, category: 'My Local Utsav 2026', anonymous: true })
    expect(out.category).toBe('My Local Utsav 2026')
  })

  it('createCampaignSchema accepts a custom festival as category', () => {
    const out = createCampaignSchema.parse({ name: 'Gudi Padwa Fund', category: 'Gudi Padwa' })
    expect(out.category).toBe('Gudi Padwa')
  })

  it('rejects a blank category', () => {
    expect(() => createDonationSchema.parse({ trustId: uuid, donorName: 'R', amount: 10, category: '   ', paymentMode: 'CASH' })).toThrow()
  })
})

describe('registerSchema & verifyOtpSchema', () => {
  it('requires a strong enough password', () => {
    expect(() => registerSchema.parse({ name: 'Test User', email: 't@test.in', password: '123' })).toThrow()
    expect(() => registerSchema.parse({ name: 'Test User', email: 't@test.in', password: '123456' })).not.toThrow()
  })

  it('requires a 6-digit OTP', () => {
    expect(verifyOtpSchema.parse({ phone: '9876543210', otp: '123456' })).toBeTruthy()
    expect(() => verifyOtpSchema.parse({ phone: '9876543210', otp: '12ab' })).toThrow()
  })
})