import QRCode from 'qrcode'
import type { Donation, ReceiptTemplate, Trust, TrustMember } from '@prisma/client'
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

function toTemplateView(template: ReceiptTemplate): ReceiptTemplateView {
  return {
    id: template.id,
    name: template.name,
    pageSize: template.pageSize,
    widthMm: template.widthMm,
    heightMm: template.heightMm,
    backgroundImageUrl: template.backgroundImageUrl,
    fieldConfigs: template.fieldConfigs as unknown as ReceiptFieldConfig[],
  }
}

async function findTemplate(trustId: string, templateId?: string): Promise<ReceiptTemplate | null> {
  return templateId
    ? await prisma.receiptTemplate.findUnique({ where: { id: templateId } })
    : await prisma.receiptTemplate.findFirst({ where: { trustId, active: true } })
}

interface ReceiptBuilderInput {
  collector?: (TrustMember & { user?: { name: string } | null }) | null
  collectorName?: string | null
}

async function buildReceiptData(
  trust: Trust,
  donation: Donation,
  receiptNumber: string,
  input: ReceiptBuilderInput = {},
): Promise<ReceiptData> {
  let paymentBreakdown: string | undefined
  let transactionRef: string | undefined
  if (donation.paymentMode === 'MIXED') {
    const splits = await prisma.donationSplit.findMany({ where: { donationId: donation.id }, orderBy: { createdAt: 'asc' } })
    paymentBreakdown = splits.map((s) => `${(PAYMENT_MODE_LABELS as Record<string, string>)[s.paymentMode] ?? s.paymentMode} ₹${formatInrAmount(s.amount)}`).join(' + ')
    const refs = splits.map((s) => s.transactionRef).filter(Boolean)
    if (refs.length) transactionRef = refs.join(' / ')
  }

  return {
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
}

async function renderAndStoreReceiptPdf(params: {
  trust: Trust
  template: ReceiptTemplateView
  data: ReceiptData
  verificationToken: string
}): Promise<string> {
  const verificationUrl = `${config.webOrigin}/receipt/verify/${params.verificationToken}`
  const background = params.template.backgroundImageUrl ? (await fileFromUrl(params.template.backgroundImageUrl))?.buffer ?? null : null
  const logo = params.trust.logoUrl ? (await fileFromUrl(params.trust.logoUrl))?.buffer ?? null : null
  const qr = await generateQrPng(verificationUrl)
  const pdfBytes = await renderReceiptPdf({
    template: params.template,
    data: params.data,
    background,
    logo,
    qr,
  })
  const stored = await savePdf(pdfBytes, `receipts/${params.trust.id}`)
  return stored.url
}

export async function generateReceipt(input: GenerateReceiptInput): Promise<{ id: string; receiptNumber: string; pdfUrl: string; verificationToken: string }> {
  const { donation, trust } = input

  const template = await findTemplate(trust.id, input.templateId)

  if (!template) {
    throw new AppError(400, 'No receipt template configured. Please create and activate a Pāvati template first.')
  }

  const year = new Date(donation.donationDate).getFullYear().toString()
  const receiptNumber = await getNextReceiptNumber(trust.id, year)

  const verificationToken = randomBytes(16).toString('hex')

  try {
    const data = await buildReceiptData(trust, donation, receiptNumber, { collector: input.collector, collectorName: input.collectorName })
    const pdfUrl = await renderAndStoreReceiptPdf({ trust, template: toTemplateView(template), data, verificationToken })

    const receipt = await prisma.receipt.create({
      data: {
        receiptNumber,
        donationId: donation.id,
        trustId: trust.id,
        templateId: template.id,
        pdfUrl,
        verificationToken,
      },
    })

    return {
      id: receipt.id,
      receiptNumber,
      pdfUrl,
      verificationToken,
    }
  } catch (e) {
    logger.error({ err: e }, 'PDF generation failed')
    throw new AppError(500, 'Failed to generate receipt PDF')
  }
}

export async function regenerateReceiptPdf(donationId: string): Promise<number> {
  const receipts = await prisma.receipt.findMany({
    where: { donationId, status: 'ACTIVE' },
    include: { donation: true, trust: true },
  })
  if (receipts.length === 0) return 0

  let regenerated = 0
  for (const receipt of receipts) {
    try {
      const template = await prisma.receiptTemplate.findUnique({ where: { id: receipt.templateId } })
      if (!template) continue
      const collector = receipt.donation.collectorId
        ? await prisma.trustMember.findUnique({ where: { id: receipt.donation.collectorId }, include: { user: true } })
        : null
      const data = await buildReceiptData(receipt.trust, receipt.donation, receipt.receiptNumber, { collector })
      const pdfUrl = await renderAndStoreReceiptPdf({
        trust: receipt.trust,
        template: toTemplateView(template),
        data,
        verificationToken: receipt.verificationToken,
      })
      await prisma.receipt.update({ where: { id: receipt.id }, data: { pdfUrl } })
      regenerated++
    } catch (e) {
      logger.error({ err: e, receiptId: receipt.id }, 'Receipt PDF regeneration failed')
    }
  }
  return regenerated
}

export async function verifyReceiptData(token: string) {
  const receipt = await prisma.receipt.findUnique({
    where: { verificationToken: token },
    include: { donation: { include: { trust: true } }, trust: true },
  })
  if (!receipt) return null
  const privacy = receipt.donation.privacy
  return {
    id: receipt.id,
    verified: receipt.status === 'ACTIVE',
    receiptNumber: receipt.receiptNumber,
    trustName: receipt.trust.name,
    trustLogo: receipt.trust.logoUrl ?? null,
    donationDate: receipt.donation.donationDate,
    amount: receipt.donation.amount,
    donorName: privacy === 'ANONYMOUS' ? 'Anonymous Donor' : receipt.donation.donorName,
    status: receipt.status,
    pdfUrl: receipt.pdfUrl,
  }
}