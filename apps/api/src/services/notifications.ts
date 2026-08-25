import { prisma } from '../lib/prisma.js'
import { config } from '../config/index.js'
import { emailProvider, type MessageSender } from '../providers/messaging.js'
import { logger } from '../lib/logger.js'
import { formatINR, NOTIFICATION_CHANNEL } from '@pavati/shared'

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

const channelSender: Record<string, MessageSender> = {
  EMAIL: emailProvider,
}

export async function sendReceiptNotifications(input: DonationReceiptNotificationInput): Promise<void> {
  const message = buildReceiptMessage(input)
  const jobs: Array<{ channel: string; to: string | null | undefined }> = [
    { channel: 'EMAIL', to: input.channels.email ? input.donorEmail : null },
  ]

  for (const job of jobs) {
    if (!job.to) continue
    const sender = channelSender[job.channel]
    if (!sender) continue
    try {
      const result = await sender.send(job.to, message, `${config.webOrigin}/receipt/verify/${input.receiptVerificationToken}`)
      await prisma.notification.create({
        data: {
          trustId: input.trustId,
          recipientPhone: job.channel === 'EMAIL' ? null : job.to,
          recipientEmail: job.channel === 'EMAIL' ? job.to : null,
          channel: job.channel as (typeof NOTIFICATION_CHANNEL)[keyof typeof NOTIFICATION_CHANNEL],
          message,
          status: result.ok ? 'SENT' : 'FAILED',
          providerResponse: result.providerResponse,
        },
      })
    } catch (e) {
      logger.error({ err: e, channel: job.channel }, 'notification send failed')
      await prisma.notification.create({
        data: {
          trustId: input.trustId,
          recipientPhone: job.channel === 'EMAIL' ? null : job.to,
          recipientEmail: job.channel === 'EMAIL' ? job.to : null,
          channel: job.channel as (typeof NOTIFICATION_CHANNEL)[keyof typeof NOTIFICATION_CHANNEL],
          message,
          status: 'FAILED',
          providerResponse: e instanceof Error ? e.message : 'unknown error',
        },
      })
    }
  }
}