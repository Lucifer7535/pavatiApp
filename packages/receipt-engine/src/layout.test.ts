import { describe, expect, it } from 'vitest'
import { buildDrawOps, buildFieldValues, wrapText, type BuildDrawOpts } from './layout.js'
import { normalizeFont, pagePx, DEFAULT_FIELDS } from './types.js'

const SAMPLE = {
  trustName: 'Shree Ganesh Mitra Mandal',
  trustAddress: 'Ganesh Mandir Road, Kothrud, Pune',
  receiptNumber: 'RC-2026-000001',
  receiptDate: '2026-08-20T10:00:00.000Z',
  donorName: 'Rajesh Patil',
  donorPhone: '9876543210',
  amount: 501,
  paymentMode: 'CASH',
  category: 'Ganpati Donation',
  collectorName: 'Sanjay Kulkarni',
}

const measure: BuildDrawOpts['measure'] = (text, size) => text.length * size * 0.5

describe('pagePx', () => {
  it('returns standard sizes for A4/A5/A6', () => {
    expect(pagePx('A4')).toEqual({ width: 794, height: 1123 })
    expect(pagePx('A5')).toEqual({ width: 559, height: 794 })
    expect(pagePx('A6')).toEqual({ width: 397, height: 559 })
  })

  it('converts custom mm to px at 96dpi', () => {
    expect(pagePx('CUSTOM', 148, 83)).toEqual({ width: 559, height: 314 })
  })

  it('falls back to 148x83mm for unknown sizes', () => {
    expect(pagePx('NOPE' as any)).toEqual({ width: 559, height: 314 })
  })
})

describe('normalizeFont', () => {
  it('passes through known font keys', () => {
    expect(normalizeFont('Mukta')).toBe('Mukta')
    expect(normalizeFont('Mukta-Bold')).toBe('Mukta-Bold')
  })

  it('maps weight hints', () => {
    expect(normalizeFont('anything-bold')).toBe('Mukta-Bold')
    expect(normalizeFont('anything-medium')).toBe('Mukta-Medium')
    expect(normalizeFont('anything-semibold')).toBe('Mukta-SemiBold')
    expect(normalizeFont('plain')).toBe('Mukta')
  })
})

describe('buildFieldValues', () => {
  it('formats amount and words using Indian numbering', () => {
    const v = buildFieldValues(SAMPLE as any)
    expect(v.amount).toBe('501')
    expect(v.amountInWords).toBe('Five Hundred One Rupees Only')
  })

  it('formats payment mode via shared labels', () => {
    expect(buildFieldValues(SAMPLE as any).paymentMode).toBe('Cash')
  })

  it('defaults empty optional fields and footer', () => {
    const v = buildFieldValues(SAMPLE as any)
    expect(v.donorPhone).toBe('9876543210')
    expect(v.footerText).toContain('धन्यवाद')
    expect(v.signature).toBe('Authorized Signature')
  })
})

describe('wrapText', () => {
  it('wraps long text to width', () => {
    const lines = wrapText('a very long line of text that should wrap', measure, 12, false, 120)
    expect(lines.length).toBeGreaterThan(1)
    expect(lines.every((l) => measure(l, 12, false) <= 120)).toBe(true)
  })

  it('collapses whitespace and trims', () => {
    expect(wrapText('  a    b ', measure, 12, false, 100)).toEqual(['a b'])
  })

  it('returns empty for blank text', () => {
    expect(wrapText('   ', measure, 12, false, 100)).toEqual([])
  })
})

describe('buildDrawOps', () => {
  const base = { id: 't1', name: 'T', pageSize: 'A5', widthMm: null, heightMm: null, backgroundImageUrl: null, fieldConfigs: DEFAULT_FIELDS }

  it('produces ops on an A5 page with scaled fonts', () => {
    const { ops, page } = buildDrawOps(base as any, SAMPLE as any, { measure })
    expect(page).toEqual({ width: 559, height: 794 })
    expect(ops.length).toBeGreaterThan(0)
    const trustName = ops.find((o) => o.value?.includes('Shree Ganesh'))
    expect(trustName).toBeTruthy()
    // fontSize scaled by page.width / 794
    expect(trustName!.fontSize).toBeCloseTo(30 * (559 / 794), 1)
  })

  it('skips invisible fields', () => {
    const cfg = [{ key: 'donorName', label: 'x', x: 10, y: 10, width: 50, height: 10, fontSize: 14, fontFamily: 'Mukta', color: '#000', align: 'left', bold: false, visible: false }]
    const { ops } = buildDrawOps({ ...base, fieldConfigs: cfg } as any, SAMPLE as any, { measure })
    expect(ops).toEqual([])
  })

  it('skips fields whose value is empty', () => {
    const cfg = [{ key: 'transactionRef', label: 'x', x: 10, y: 10, width: 50, height: 10, fontSize: 14, fontFamily: 'Mukta', color: '#000', align: 'left', bold: false, visible: true }]
    const { ops } = buildDrawOps({ ...base, fieldConfigs: cfg } as any, SAMPLE as any, { measure })
    expect(ops).toEqual([])
  })

  it('prefixes amount with ₹', () => {
    const cfg = [{ key: 'amount', label: 'x', x: 10, y: 10, width: 50, height: 10, fontSize: 20, fontFamily: 'Mukta', color: '#000', align: 'right', bold: false, visible: true }]
    const { ops } = buildDrawOps({ ...base, fieldConfigs: cfg } as any, SAMPLE as any, { measure })
    expect(ops[0].value).toBe('₹ 501')
  })

  it('applies field prefixes', () => {
    const cfg = [{ key: 'receiptNumber', label: 'x', x: 10, y: 10, width: 50, height: 10, fontSize: 14, fontFamily: 'Mukta', color: '#000', align: 'left', bold: false, visible: true, prefix: 'No: ' }]
    const { ops } = buildDrawOps({ ...base, fieldConfigs: cfg } as any, SAMPLE as any, { measure })
    expect(ops[0].value).toBe('No: RC-2026-000001')
  })

  it('renders signature as a line plus text', () => {
    const cfg = [{ key: 'signature', label: 'x', x: 10, y: 10, width: 30, height: 10, fontSize: 13, fontFamily: 'Mukta', color: '#000', align: 'left', bold: false, visible: true }]
    const { ops } = buildDrawOps({ ...base, fieldConfigs: cfg } as any, SAMPLE as any, { measure })
    expect(ops.map((o) => o.kind)).toEqual(['line', 'text'])
    expect(ops[1].value).toBe('Authorized Signature')
  })

  it('emits image ops for logo and qrCode', () => {
    const cfg = [
      { key: 'logo', label: 'x', x: 4, y: 4, width: 12, height: 22, fontSize: 0, fontFamily: 'Mukta', color: '#000', align: 'center', bold: false, visible: true },
      { key: 'qrCode', label: 'x', x: 90, y: 80, width: 7, height: 13, fontSize: 0, fontFamily: 'Mukta', color: '#000', align: 'center', bold: false, visible: true },
    ]
    const { ops } = buildDrawOps({ ...base, fieldConfigs: cfg } as any, SAMPLE as any, { measure })
    expect(ops.map((o) => o.value)).toEqual(['logo', 'qr'])
  })

  it('sizes custom pages from widthMm/heightMm', () => {
    const { page } = buildDrawOps({ ...base, pageSize: 'CUSTOM', widthMm: 148, heightMm: 83 } as any, SAMPLE as any, { measure })
    expect(page).toEqual({ width: 559, height: 314 })
  })
})