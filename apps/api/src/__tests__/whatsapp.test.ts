import { describe, it, expect } from 'vitest'
import { buildWhatsAppUrl, buildReceiptMessage, buildReceiptWhatsAppUrl } from '../services/notifications.js'

describe('buildReceiptMessage', () => {
  it('includes amount, receipt number, and verify link', () => {
    const msg = buildReceiptMessage({ amount: 501, receiptNumber: 'RC/2026/000042', receiptVerificationToken: 'tok123' })
    expect(msg).toContain('501')
    expect(msg).toContain('RC/2026/000042')
    expect(msg).toContain('/receipt/verify/tok123')
  })
})

describe('buildWhatsAppUrl', () => {
  const msg = 'hello world'
  it('prefixes Indian country code and strips non-digits when phone given', () => {
    expect(buildWhatsAppUrl('98765 43210', msg)).toBe(`https://wa.me/919876543210?text=${encodeURIComponent(msg)}`)
  })
  it('falls back to share-sheet URL without phone', () => {
    expect(buildWhatsAppUrl(null, msg)).toBe(`https://wa.me/?text=${encodeURIComponent(msg)}`)
  })
})

describe('buildReceiptWhatsAppUrl', () => {
  const input = { amount: 501, receiptNumber: 'R1', receiptVerificationToken: 't' }
  it('returns null when whatsapp toggle disabled', () => {
    expect(buildReceiptWhatsAppUrl({ donorPhone: '9876543210', ...input }, false)).toBeNull()
  })
  it('uses share-sheet variant for online flow even when phone stored', () => {
    expect(buildReceiptWhatsAppUrl({ donorPhone: null, ...input }, true)).toMatch(/^https:\/\/wa\.me\/\?text=/)
  })
})
