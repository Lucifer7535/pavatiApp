import { prisma } from '../lib/prisma.js'
import { config } from '../config/index.js'
import { emailProvider } from '../providers/messaging.js'
import { logger } from '../lib/logger.js'
import { formatINR } from '@pavati/shared'

export interface DonationReceiptNotificationInput {
  trustId: string
  donorName: string
  donorPhone?: string | null
  donorEmail?: string | null
  amount: number
  receiptNumber: string
  receiptVerificationToken: string
  channels: { sms: boolean; whatsapp: boolean; email: boolean }
}

export interface ReceiptShareInput {
  donorPhone?: string | null
  amount: number
  receiptNumber: string
  receiptVerificationToken: string
}

export function buildReceiptMessage(input: Omit<ReceiptShareInput, 'donorPhone'>): string {
  return [
    `Thank you for your contribution.`,
    `Donation Amount: ${formatINR(input.amount)}`,
    `Receipt No: ${input.receiptNumber}`,
    `View your receipt: ${config.webOrigin}/receipt/verify/${input.receiptVerificationToken}`,
  ].join('\n')
}

export function buildWhatsAppUrl(phone: string | null | undefined, message: string): string {
  const text = encodeURIComponent(message)
  const digits = phone?.replace(/\D/g, '')
  return digits ? `https://wa.me/91${digits}?text=${text}` : `https://wa.me/?text=${text}`
}

export function buildReceiptWhatsAppUrl(input: ReceiptShareInput, whatsappEnabled: boolean): string | null {
  if (!whatsappEnabled) return null
  return buildWhatsAppUrl(input.donorPhone ?? null, buildReceiptMessage(input))
}

export async function sendReceiptNotifications(input: DonationReceiptNotificationInput): Promise<void> {
  const message = buildReceiptMessage(input)
  const to = input.channels.email ? input.donorEmail : null
  if (!to) return
  let result: { ok: boolean; providerResponse: string | null }
  try {
    result = await emailProvider.send(to, message, `${config.webOrigin}/receipt/verify/${input.receiptVerificationToken}`)
  } catch (e) {
    logger.error({ err: e }, 'notification send failed')
    result = { ok: false, providerResponse: e instanceof Error ? e.message : 'unknown error' }
  }
  await prisma.notification.create({
    data: {
      trustId: input.trustId,
      recipientEmail: to,
      channel: 'EMAIL',
      message,
      status: result.ok ? 'SENT' : 'FAILED',
      providerResponse: result.providerResponse,
    },
  })
}