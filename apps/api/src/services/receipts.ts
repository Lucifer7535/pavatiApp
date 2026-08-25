import QRCode from 'qrcode'
import type { Donation, Trust, TrustMember } from '@prisma/client'
import type { ReceiptFieldConfig } from '@pavati/shared'
import { PAYMENT_MODE_LABELS } from '@pavati/shared'
import { randomBytes } from 'node:crypto'
import { prisma } from '../lib/prisma.js'
import { config } from '../config/index.js'
import { fileFromUrl, savePdf } from '../providers/storage.js'
import { renderReceiptPdf, type ReceiptData } from '@pavati/receipt-engine/server'
import type { ReceiptTemplateView } from '@pavati/receipt-engine'
import { AppError } from '../lib/http.js'
import { logger } from '../lib/logger.js'

export async function generateQrPng(text: string): Promise<Uint8Array> {
  return QRCode.toBuffer(text, { type: 'png', width: 400, margin: 1, errorCorrectionLevel: 'M' })
}

function formatInrAmount(n: number): string {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n)
}

interface GenerateReceiptInput {
  donationId: string
  templateId?: string
  trust: Trust
  donation: Donation
  collector?: (TrustMember & { user?: { name: string } | null }) | null
  collectorName?: string | null
  actorId?: string | null
}

export async function getNextReceiptNumber(trustId: string, year: string): Promise<string> {
  return prisma.$transaction(async (tx) => {
    let cfg = await tx.receiptNumberConfig.findUnique({
      where: { trustId_prefix_year: { trustId, prefix: 'RC', year } },
    })
    if (!cfg) {
      cfg = await tx.receiptNumberConfig.create({
        data: { trustId, prefix: 'RC', year, nextSequence: 1, padLength: 6 },
      })
    }
    const seq = cfg.nextSequence
    await tx.receiptNumberConfig.update({
      where: { id: cfg.id },
      data: { nextSequence: seq + 1 },
    })
    const padded = String(seq).padStart(cfg.padLength, '0')
    return `${cfg.prefix}${cfg.separator}${year}${cfg.separator}${padded}`
  })
}

export async function generateReceipt(input: GenerateReceiptInput): Promise<{ id: string; receiptNumber: string; pdfUrl: string; verificationToken: string }> {
  const { donation, trust } = input

  const template = input.templateId
    ? await prisma.receiptTemplate.findUnique({ where: { id: input.templateId } })
    : await prisma.receiptTemplate.findFirst({ where: { trustId: trust.id, active: true } })

  if (!template) {
    throw new AppError(400, 'No receipt template configured. Please create and activate a Pāvati template first.')
  }

  const templateView: ReceiptTemplateView = {
    id: template.id,
    name: template.name,
    pageSize: template.pageSize,
    widthMm: template.widthMm,
    heightMm: template.heightMm,
    backgroundImageUrl: template.backgroundImageUrl,
    fieldConfigs: template.fieldConfigs as unknown as ReceiptFieldConfig[],
  }

  const year = new Date(donation.donationDate).getFullYear().toString()
  const receiptNumber = await getNextReceiptNumber(trust.id, year)

  const verificationToken = randomBytes(16).toString('hex')
  const verificationUrl = `${config.webOrigin}/receipt/verify/${verificationToken}`

  const background = template.backgroundImageUrl ? (await fileFromUrl(template.backgroundImageUrl))?.buffer ?? null : null
  const logo = trust.logoUrl ? (await fileFromUrl(trust.logoUrl))?.buffer ?? null : null
  const qr = await generateQrPng(verificationUrl)

  let paymentBreakdown: string | undefined
  let transactionRef: string | undefined
  if (donation.paymentMode === 'MIXED') {
    const splits = await prisma.donationSplit.findMany({ where: { donationId: donation.id }, orderBy: { createdAt: 'asc' } })
    paymentBreakdown = splits.map((s) => `${(PAYMENT_MODE_LABELS as Record<string, string>)[s.paymentMode] ?? s.paymentMode} ₹${formatInrAmount(s.amount)}`).join(' + ')
    const refs = splits.map((s) => s.transactionRef).filter(Boolean)
    if (refs.length) transactionRef = refs.join(' / ')
  }

  const data: ReceiptData = {
    trustName: trust.name,
    trustAddress: [trust.address, trust.city, trust.pinCode].filter(Boolean).join(', '),
    receiptNumber,
    receiptDate: donation.donationDate.toISOString(),
    donorName: donation.donorName,
    donorPhone: donation.phone ?? undefined,
    donorAddress: donation.address ?? undefined,
    amount: donation.amount,
    paymentMode: donation.paymentMode,
    paymentBreakdown,
    category: donation.category,
    transactionRef: transactionRef ?? donation.transactionRef ?? undefined,
    collectorName: input.collectorName ?? (input.collector ? `${input.collector.position || ''} ${input.collector.user?.name ?? ''}`.trim() : undefined),
    footerText: `धन्यवाद - Thank you for your generous support`,
  }

  try {
    const pdfBytes = await renderReceiptPdf({
      template: templateView,
      data,
      background,
      logo,
      qr,
    })
    const stored = await savePdf(pdfBytes, `receipts/${trust.id}`)

    const receipt = await prisma.receipt.create({
      data: {
        receiptNumber,
        donationId: donation.id,
        trustId: trust.id,
        templateId: template.id,
        pdfUrl: stored.url,
        verificationToken,
      },
    })

    return {
      id: receipt.id,
      receiptNumber,
      pdfUrl: stored.url,
      verificationToken,
    }
  } catch (e) {
    logger.error({ err: e }, 'PDF generation failed')
    throw new AppError(500, 'Failed to generate receipt PDF')
  }
}

export async function verifyReceiptData(token: string) {
  const receipt = await prisma.receipt.findUnique({
    where: { verificationToken: token },
    include: { donation: { include: { trust: true } }, trust: true },
  })
  if (!receipt) return null
  const privacy = receipt.donation.privacy
  return {
    verified: receipt.status === 'ACTIVE',
    receiptNumber: receipt.receiptNumber,
    trustName: receipt.trust.name,
    donationDate: receipt.donation.donationDate,
    amount: receipt.donation.amount,
    donorName: privacy === 'ANONYMOUS' ? 'Anonymous Donor' : receipt.donation.donorName,
    status: receipt.status,
  }
}