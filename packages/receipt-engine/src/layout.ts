import { amountInWords, formatDate, PAYMENT_MODE_LABELS, type PaymentMode } from '@pavati/shared'
import { FONT_CACHE } from './fonts.js'
import { type DrawOp, type ReceiptData, type ReceiptTemplateView } from './types.js'
import { normalizeFont, pagePx } from './types.js'

function formatAmount(n: number): string {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n)
}

export function buildFieldValues(data: ReceiptData): Record<string, string> {
  const mode = data.paymentMode as PaymentMode
  const modeLabel = PAYMENT_MODE_LABELS[mode] ?? data.paymentMode
  return {
    trustName: data.trustName,
    trustAddress: data.trustAddress ?? '',
    receiptNumber: data.receiptNumber,
    receiptDate: formatDate(data.receiptDate),
    donorName: data.donorName,
    donorPhone: data.donorPhone ?? '',
    donorAddress: data.donorAddress ?? '',
    amount: formatAmount(data.amount),
    amountInWords: amountInWords(data.amount),
    paymentMode: data.paymentBreakdown ? `${modeLabel} (${data.paymentBreakdown})` : modeLabel,
    donationCategory: data.category,
    transactionRef: data.transactionRef ?? '',
    collectorName: data.collectorName ?? '',
    signature: 'Authorized Signature',
    footerText: data.footerText ?? `धन्यवाद — Thank you for your generous support`,
    qrCode: '',
    logo: '',
  }
}

export interface MeasureFn {
  (text: string, size: number, bold: boolean): number
}

export function wrapText(text: string, measure: MeasureFn, size: number, bold: boolean, maxWidth: number): string[] {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (!clean) return []
  const words = clean.split(' ')
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (current && measure(candidate, size, bold) > maxWidth) {
      lines.push(current)
      current = word
    } else {
      current = candidate
    }
  }
  if (current) lines.push(current)
  return lines
}

export interface BuildDrawOpts {
  logoImage?: HTMLImageElement | HTMLCanvasElement | ImageBitmap | null
  qrImage?: HTMLImageElement | HTMLCanvasElement | ImageBitmap | null
  measure?: MeasureFn
}

export function buildDrawOps(
  template: ReceiptTemplateView,
  data: ReceiptData,
  opts: BuildDrawOpts = {}
): { ops: DrawOp[]; page: { width: number; height: number } } {
  const page = pagePx(template.pageSize, template.widthMm, template.heightMm)
  const values = buildFieldValues(data)
  const ops: DrawOp[] = []
  const refWidth = 794

  const measure: MeasureFn =
    opts.measure ??
    ((text: string, size: number, bold: boolean) => {
      const fam = bold ? 'Mukta-Bold' : 'Mukta'
      const font = FONT_CACHE[fam]
      if (font) return font.widthOfTextAtSize(text, size)
      return text.length * size * 0.55
    })

  for (const f of template.fieldConfigs ?? []) {
    if (!f.visible) continue
    const scale = page.width / refWidth
    const x = (f.x / 100) * page.width
    const y = (f.y / 100) * page.height
    const width = (f.width / 100) * page.width
    const height = (f.height / 100) * page.height
    const fontSize = Math.max(4, f.fontSize * scale)
    const fontKey = normalizeFont(f.fontFamily)

    if (f.key === 'qrCode') {
      ops.push({ kind: 'image', value: 'qr', image: opts.qrImage ?? null, x, y, width, height, fontSize, fontFamily: fontKey, color: f.color, align: f.align, bold: f.bold })
      continue
    }
    if (f.key === 'logo') {
      ops.push({ kind: 'image', value: 'logo', image: opts.logoImage ?? null, x, y, width, height, fontSize, fontFamily: fontKey, color: f.color, align: f.align, bold: f.bold })
      continue
    }

    let raw = values[f.key] ?? ''
    if (!raw) continue
    let prefix = f.prefix ?? ''
    let text = `${prefix}${raw}`
    if (f.key === 'amount') text = `₹ ${raw}`

    if (f.key === 'signature') {
      const lineY = y + height * 0.6
      ops.push({ kind: 'line', x, y: lineY, width, height: 1, fontSize, fontFamily: fontKey, color: '#4a1f0c', align: f.align, bold: false })
      ops.push({ kind: 'text', value: 'Authorized Signature', x, y: lineY + fontSize * 1.1, width, height: fontSize, fontSize: Math.max(8, fontSize * 0.85), fontFamily: 'Mukta', color: '#6b4a2b', align: 'center', bold: false })
      continue
    }

    if (f.key === 'footerText') {
      ops.push({ kind: 'text', value: text, x, y, width, height, fontSize, fontFamily: fontKey, color: f.color, align: f.align, bold: f.bold, alpha: 0.75 })
      continue
    }

    const lines = wrapText(text, measure, fontSize, f.bold, width)
    let ly = y
    for (const line of lines) {
      ops.push({ kind: 'text', value: line, x, y: ly, width, height: fontSize, fontSize, fontFamily: fontKey, color: f.color, align: f.align, bold: f.bold })
      ly += fontSize * 1.22
    }
  }

  return { ops, page }
}