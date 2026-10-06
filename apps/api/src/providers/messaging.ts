import { sendEmail } from '../lib/email.js'

export interface SendResult {
  ok: boolean
  providerResponse: string | null
}

export interface MessageSender {
  send(to: string, message: string, receiptLink?: string): Promise<SendResult>
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)
}

export class ResendEmailProvider implements MessageSender {
  async send(to: string, message: string, receiptLink?: string): Promise<SendResult> {
    const safeMessage = escapeHtml(message)
    const safeReceiptLink = receiptLink?.startsWith('http') ? receiptLink : undefined
    const html = `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #1c1917;">Pāvati Receipt</h2>
        <p style="white-space: pre-line; color: #44403c;">${safeMessage}</p>
        ${safeReceiptLink ? `<p style="margin-top: 16px;"><a href="${escapeHtml(safeReceiptLink)}" style="display:inline-block;padding:10px 20px;background:#16a34a;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">View Receipt</a></p>` : ''}
        <p style="margin-top: 24px; font-size: 12px; color: #a8a29e;">This is an automated message from Pāvati Pustak.</p>
      </div>
    `
    const ok = await sendEmail({ to, subject: 'Your Pāvati Receipt', html, text: message })
    return { ok, providerResponse: ok ? `resend-${Date.now()}` : 'resend-failed' }
  }
}

export const emailProvider: MessageSender = new ResendEmailProvider()