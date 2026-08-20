import { prisma } from '../lib/prisma.js'
import { config } from '../config/index.js'
import { emailProvider, smsProvider, whatsappProvider, type MessageSender } from '../providers/messaging.js'
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

function buildMessage(input: Omit<DonationReceiptNotificationInput, 'channels'>): string {
  return [
    `Thank you for your contribution.`,
    `Donation Amount: ${formatINR(input.amount)}`,
    `Receipt No: ${input.receiptNumber}`,
    `View your receipt: ${config.webOrigin}/receipt/verify/${input.receiptVerificationToken}`,
  ].join('\n')
}

const channelSender: Record<string, MessageSender> = {
  SMS: smsProvider,
  WHATSAPP: whatsappProvider,
  EMAIL: emailProvider,
}

export async function sendReceiptNotifications(input: DonationReceiptNotificationInput): Promise<void> {
  const message = buildMessage(input)
  const jobs: Array<{ channel: string; to: string | null | undefined }> = [
    { channel: 'SMS', to: input.channels.sms ? input.donorPhone : null },
    { channel: 'WHATSAPP', to: input.channels.whatsapp ? input.donorPhone : null },
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