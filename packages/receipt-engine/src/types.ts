import type { PageSize, ReceiptFieldConfig } from '@pavati/shared'

export type ReceiptFieldKey =
  | 'trustName'
  | 'trustAddress'
  | 'receiptNumber'
  | 'receiptDate'
  | 'donorName'
  | 'donorPhone'
  | 'donorAddress'
  | 'amount'
  | 'amountInWords'
  | 'paymentMode'
  | 'donationCategory'
  | 'transactionRef'
  | 'collectorName'
  | 'signature'
  | 'qrCode'
  | 'logo'
  | 'footerText'

export const FIELD_KEYS: ReceiptFieldKey[] = [
  'trustName',
  'trustAddress',
  'receiptNumber',
  'receiptDate',
  'donorName',
  'donorPhone',
  'donorAddress',
  'amount',
  'amountInWords',
  'paymentMode',
  'donationCategory',
  'transactionRef',
  'collectorName',
  'signature',
  'qrCode',
  'logo',
  'footerText',
]

export const FIELD_LABELS: Record<ReceiptFieldKey, string> = {
  trustName: 'Trust Name',
  trustAddress: 'Trust Address',
  receiptNumber: 'Receipt Number',
  receiptDate: 'Receipt Date',
  donorName: 'Donor / Payee Name',
  donorPhone: 'Donor Phone',
  donorAddress: 'Donor Address',
  amount: 'Amount',
  amountInWords: 'Amount in Words',
  paymentMode: 'Payment Mode',
  donationCategory: 'Donation Category',
  transactionRef: 'Transaction / Ref Number',
  collectorName: 'Collector / Member Name',
  signature: 'Authorized Signature',
  qrCode: 'Verification QR Code',
  logo: 'Trust Logo',
  footerText: 'Footer / Thank You Text',
}

export interface ReceiptData {
  trustName: string
  trustAddress?: string
  receiptNumber: string
  receiptDate: string
  donorName: string
  donorPhone?: string
  donorAddress?: string
  amount: number
  paymentMode: string
  paymentBreakdown?: string
  category: string
  transactionRef?: string
  collectorName?: string
  footerText?: string
}

export interface ReceiptTemplateView {
  id: string
  name: string
  pageSize: PageSize
  widthMm: number | null
  heightMm: number | null
  backgroundImageUrl: string | null
  fieldConfigs: ReceiptFieldConfig[]
  bgFit?: 'cover' | 'contain' | 'stretch'
}

export type FontKey = 'Mukta' | 'Mukta-Medium' | 'Mukta-SemiBold' | 'Mukta-Bold'

export const FONT_CSS: Record<FontKey, { family: string; weight: number }> = {
  Mukta: { family: 'Mukta', weight: 400 },
  'Mukta-Medium': { family: 'Mukta', weight: 500 },
  'Mukta-SemiBold': { family: 'Mukta', weight: 600 },
  'Mukta-Bold': { family: 'Mukta', weight: 700 },
}

export interface DrawOp {
  kind: 'text' | 'image' | 'line' | 'rect'
  value?: string
  image?: HTMLImageElement | HTMLCanvasElement | ImageBitmap | null
  x: number
  y: number
  width: number
  height: number
  fontSize: number
  fontFamily: string
  color: string
  align: 'left' | 'center' | 'right'
  bold: boolean
  alpha?: number
}

export function normalizeFont(family: string): FontKey {
  if (family in FONT_CSS) return family as FontKey
  if (/semi/i.test(family)) return 'Mukta-SemiBold'
  if (/bold/i.test(family)) return 'Mukta-Bold'
  if (/medium/i.test(family)) return 'Mukta-Medium'
  return 'Mukta'
}

export const DEFAULT_FIELDS: ReceiptFieldConfig[] = [
  { key: 'logo', label: 'Trust Logo', x: 4, y: 6, width: 12, height: 22, fontSize: 0, fontFamily: 'Mukta', color: '#4a1f0c', align: 'center', bold: false, visible: true },
  { key: 'trustName', label: 'Trust Name', x: 18, y: 8, width: 64, height: 12, fontSize: 30, fontFamily: 'Mukta-Bold', color: '#7f1d1d', align: 'center', bold: true, visible: true },
  { key: 'trustAddress', label: 'Trust Address', x: 18, y: 19, width: 64, height: 8, fontSize: 13, fontFamily: 'Mukta', color: '#4a1f0c', align: 'center', bold: false, visible: true },
  { key: 'receiptNumber', label: 'Receipt Number', x: 55, y: 4, width: 41, height: 8, fontSize: 16, fontFamily: 'Mukta-SemiBold', color: '#7f1d1d', align: 'right', bold: true, visible: true, prefix: 'Receipt No: ' },
  { key: 'receiptDate', label: 'Receipt Date', x: 4, y: 32, width: 34, height: 7, fontSize: 14, fontFamily: 'Mukta', color: '#4a1f0c', align: 'left', bold: false, visible: true, prefix: 'Date: ', showLabel: true },
  { key: 'donorName', label: 'Donor / Payee Name', x: 4, y: 42, width: 60, height: 8, fontSize: 19, fontFamily: 'Mukta-SemiBold', color: '#4a1f0c', align: 'left', bold: true, visible: true, prefix: 'Received with thanks from: ' },
  { key: 'donorPhone', label: 'Donor Phone', x: 4, y: 52, width: 60, height: 7, fontSize: 14, fontFamily: 'Mukta', color: '#4a1f0c', align: 'left', bold: false, visible: true, prefix: 'Mobile: ' },
  { key: 'amount', label: 'Amount', x: 66, y: 36, width: 30, height: 14, fontSize: 38, fontFamily: 'Mukta-Bold', color: '#7f1d1d', align: 'right', bold: true, visible: true, prefix: '₹ ' },
  { key: 'amountInWords', label: 'Amount in Words', x: 4, y: 62, width: 92, height: 9, fontSize: 15, fontFamily: 'Mukta', color: '#4a1f0c', align: 'left', bold: false, visible: true, prefix: 'Rupees ' },
  { key: 'paymentMode', label: 'Payment Mode', x: 4, y: 73, width: 45, height: 7, fontSize: 14, fontFamily: 'Mukta', color: '#4a1f0c', align: 'left', bold: false, visible: true, prefix: 'Mode: ' },
  { key: 'donationCategory', label: 'Donation Category', x: 50, y: 73, width: 46, height: 7, fontSize: 14, fontFamily: 'Mukta', color: '#4a1f0c', align: 'left', bold: false, visible: true, prefix: 'Category: ' },
  { key: 'transactionRef', label: 'Transaction / Ref Number', x: 4, y: 82, width: 60, height: 7, fontSize: 14, fontFamily: 'Mukta', color: '#4a1f0c', align: 'left', bold: false, visible: true, prefix: 'Ref No: ' },
  { key: 'collectorName', label: 'Collector / Member Name', x: 60, y: 90, width: 36, height: 7, fontSize: 13, fontFamily: 'Mukta', color: '#4a1f0c', align: 'right', bold: false, visible: true, prefix: 'Collected by: ' },
  { key: 'signature', label: 'Authorized Signature', x: 4, y: 88, width: 30, height: 10, fontSize: 13, fontFamily: 'Mukta', color: '#4a1f0c', align: 'left', bold: false, visible: true },
  { key: 'qrCode', label: 'Verification QR Code', x: 90, y: 84, width: 7, height: 13, fontSize: 0, fontFamily: 'Mukta', color: '#000000', align: 'center', bold: false, visible: true },
  { key: 'footerText', label: 'Footer / Thank You Text', x: 4, y: 94, width: 92, height: 6, fontSize: 11, fontFamily: 'Mukta', color: '#6b4a2b', align: 'center', bold: false, visible: true },
]

export const PAGE_SIZE_PX: Record<string, { width: number; height: number }> = {
  A4: { width: 794, height: 1123 },
  A5: { width: 559, height: 794 },
  A6: { width: 397, height: 559 },
}

export function pagePx(pageSize: string, widthMm?: number | null, heightMm?: number | null): { width: number; height: number } {
  const px = PAGE_SIZE_PX[pageSize]
  if (px) return px
  const w = widthMm ?? 148
  const h = heightMm ?? 83
  return { width: Math.round((w / 25.4) * 96), height: Math.round((h / 25.4) * 96) }
}